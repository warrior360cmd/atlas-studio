"""FlowPatch demonstrator: form submission -> tracker record -> task -> status, with durable state.

App A = form tool (webhook JSON). App B = tracker REST API (here: TrackerSim, an in-process simulator with fault
injection; a client install swaps it for the real connector). State lives in SQLite; every step is idempotent or
reconciled; uncertain remote writes go to `needs_review`, never blind retries.
"""
import json, re, sqlite3, time, uuid

STATES = ("queued", "record_done", "task_done", "completed", "invalid", "retry_wait", "failed", "needs_operator", "needs_review")
MAX_ATTEMPTS = 3

class Transient(Exception): pass          # 5xx / timeout before write
class Denied(Exception): pass             # 401/403: access revoked
class LostResponse(Exception): pass       # request sent, outcome unknown

class TrackerSim:
    """Simulated tracker. Records support search by external_id (reconcilable). Tasks do not (not reconcilable)."""
    def __init__(self): self.records, self.tasks, self.fail = {}, {}, {}
    def _gate(self, op):
        mode = self.fail.get(op)
        if mode == "down": raise Transient(f"{op}: 503")
        if mode == "revoked": raise Denied(f"{op}: 401")
        return mode
    def find_record(self, external_id):
        self._gate("find")
        return next((rid for rid, r in self.records.items() if r["external_id"] == external_id), None)
    def create_record(self, fields):
        mode = self._gate("create_record")
        rid = "rec_" + uuid.uuid4().hex[:8]; self.records[rid] = dict(fields)
        if mode == "lose_response": self.fail.pop("create_record"); raise LostResponse("create_record: timeout after send")
        return rid
    def create_task(self, record_id, title):
        mode = self._gate("create_task")
        tid = "tsk_" + uuid.uuid4().hex[:8]; self.tasks[tid] = {"record": record_id, "title": title}
        if mode == "lose_response": self.fail.pop("create_task"); raise LostResponse("create_task: timeout after send")
        return tid
    def set_status(self, record_id, status):
        self._gate("set_status"); self.records[record_id]["status"] = status

SCHEMA = """
create table if not exists runs (id text primary key, business_key text unique not null, payload text not null,
  state text not null, attempts integer not null default 0, last_error text, record_id text, task_id text,
  lease text, created_at real not null, updated_at real not null);
create table if not exists log (id integer primary key autoincrement, run_id text, at real, event text);
create table if not exists settings (k text primary key, v text);
"""
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

class Engine:
    def __init__(self, db_path, tracker):
        self.db = sqlite3.connect(db_path, isolation_level=None, timeout=10)
        self.db.execute("pragma journal_mode=wal"); self.db.executescript(SCHEMA); self.t = tracker
    def _log(self, run_id, event): self.db.execute("insert into log(run_id,at,event) values(?,?,?)", (run_id, time.time(), event))
    def paused(self): return (self.db.execute("select v from settings where k='paused'").fetchone() or ["0"])[0] == "1"
    def pause(self): self.db.execute("insert or replace into settings values('paused','1')"); self._log(None, "paused")
    def resume(self): self.db.execute("insert or replace into settings values('paused','0')"); self._log(None, "resumed")

    def ingest(self, payload):
        """Step 1: validate input; dedupe on business key = form id + submission id."""
        key = f"{payload.get('form_id')}:{payload.get('submission_id')}"
        errors = [f for f in ("form_id", "submission_id", "name", "email") if not str(payload.get(f) or "").strip()]
        if payload.get("email") and not EMAIL.match(payload["email"]): errors.append("email_format")
        rid = "run_" + uuid.uuid4().hex[:10]; now = time.time()
        try:
            self.db.execute("insert into runs(id,business_key,payload,state,last_error,created_at,updated_at) values(?,?,?,?,?,?,?)",
                            (rid, key, json.dumps(payload), "invalid" if errors else "queued", ",".join(errors) or None, now, now))
        except sqlite3.IntegrityError:
            existing = self.db.execute("select id from runs where business_key=?", (key,)).fetchone()[0]
            self._log(existing, "duplicate_ignored"); return existing, "duplicate"
        self._log(rid, "invalid:" + ",".join(errors) if errors else "queued")
        return rid, "invalid" if errors else "queued"

    def _claim(self, run_id):
        lease = uuid.uuid4().hex
        cur = self.db.execute("update runs set lease=? where id=? and lease is null and state in ('queued','record_done','task_done','retry_wait')", (lease, run_id))
        return lease if cur.rowcount == 1 else None

    def _set(self, run_id, **kw):
        kw["updated_at"] = time.time()
        self.db.execute(f"update runs set {','.join(k + '=?' for k in kw)} where id=?", (*kw.values(), run_id))

    def process(self, run_id):
        if self.paused(): return "paused"
        lease = self._claim(run_id)
        if not lease: return "busy_or_final"
        try:
            while True:
                r = dict(zip(("state", "payload", "record_id", "task_id", "attempts"),
                             self.db.execute("select state,payload,record_id,task_id,attempts from runs where id=?", (run_id,)).fetchone()))
                p = json.loads(r["payload"])
                if self.paused(): self._log(run_id, f"stopped_at:{r['state']}"); return "paused"
                try:
                    if r["state"] in ("queued", "retry_wait") and not r["record_id"]:
                        ext = f"{p['form_id']}:{p['submission_id']}"
                        rec = self.t.find_record(ext)  # reconcile first: never create twice
                        if not rec:
                            try: rec = self.t.create_record({"external_id": ext, "name": p["name"], "email": p["email"], "status": "Nouveau"})
                            except LostResponse:
                                rec = self.t.find_record(ext)  # record writes are reconcilable
                                if not rec: raise Transient("record outcome unknown, not found")
                                self._log(run_id, "record_reconciled_after_lost_response")
                        self._set(run_id, state="record_done", record_id=rec); self._log(run_id, "record_done"); continue
                    if r["state"] in ("record_done", "retry_wait") and r["record_id"] and not r["task_id"]:
                        try: tid = self.t.create_task(r["record_id"], f"Rappeler {p['name']}")
                        except LostResponse:  # tasks are not searchable: cannot know -> human check, no blind retry
                            self._set(run_id, state="needs_review", last_error="task creation outcome unknown"); self._log(run_id, "needs_review"); return "needs_review"
                        self._set(run_id, state="task_done", task_id=tid); self._log(run_id, "task_done"); continue
                    if r["state"] in ("task_done", "retry_wait") and r["task_id"]:
                        self.t.set_status(r["record_id"], "À rappeler")  # idempotent overwrite
                        self._set(run_id, state="completed", last_error=None); self._log(run_id, "completed"); return "completed"
                    return r["state"]
                except Transient as e:
                    n = r["attempts"] + 1
                    state = "failed" if n >= MAX_ATTEMPTS else "retry_wait"
                    self._set(run_id, state=state, attempts=n, last_error=str(e)); self._log(run_id, f"{state}:{e}")
                    return state
                except Denied as e:
                    self._set(run_id, state="needs_operator", last_error=str(e)); self._log(run_id, f"needs_operator:{e}"); return "needs_operator"
        finally:
            self.db.execute("update runs set lease=null where id=? and lease=?", (run_id, lease))

    def resolve_review(self, run_id, task_id):
        """Operator checked the tracker by hand and confirms the task id (or None if it does not exist)."""
        st = self.db.execute("select state from runs where id=?", (run_id,)).fetchone()[0]
        assert st == "needs_review", st
        self._set(run_id, state="task_done" if task_id else "record_done", task_id=task_id, last_error=None)
        self._log(run_id, f"review_resolved:{task_id}")

    def requeue(self, run_id):
        st = self.db.execute("select state from runs where id=?", (run_id,)).fetchone()[0]
        assert st in ("failed", "needs_operator"), st
        self._set(run_id, state="retry_wait", attempts=0); self._log(run_id, "requeued_by_operator")

    def status(self):
        return dict(self.db.execute("select state, count(*) from runs group by state").fetchall())

    def backup(self, dest):
        out = sqlite3.connect(dest); self.db.backup(out); out.close()

def restore_isolated(backup_path, new_path):
    """Restore into a fresh file with processing paused (triggers disabled)."""
    src = sqlite3.connect(backup_path); dst = sqlite3.connect(new_path); src.backup(dst); src.close()
    dst.execute("insert or replace into settings values('paused','1')"); dst.commit(); dst.close()
