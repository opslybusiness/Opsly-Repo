"""Lightweight in-process background job runner for long operations."""
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime
from threading import Lock
from typing import Any, Callable, Dict, Optional
import traceback
import uuid


class JobService:
    def __init__(self):
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="campaign-job")
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._futures: Dict[str, Future] = {}
        self._lock = Lock()

    def submit(self, action: str, fn: Callable[[], Any]) -> str:
        job_id = str(uuid.uuid4())
        with self._lock:
            self._jobs[job_id] = {
                "job_id": job_id,
                "action": action,
                "status": "queued",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
                "result": None,
                "error": None,
            }
        future = self._executor.submit(self._run, job_id, fn)
        with self._lock:
            self._futures[job_id] = future
        return job_id

    def _run(self, job_id: str, fn: Callable[[], Any]) -> None:
        with self._lock:
            self._jobs[job_id]["status"] = "running"
            self._jobs[job_id]["updated_at"] = datetime.utcnow().isoformat()
        try:
            result = fn()
            with self._lock:
                self._jobs[job_id]["status"] = "completed"
                self._jobs[job_id]["result"] = result
                self._jobs[job_id]["updated_at"] = datetime.utcnow().isoformat()
        except Exception as exc:
            with self._lock:
                self._jobs[job_id]["status"] = "failed"
                self._jobs[job_id]["error"] = f"{exc}\n{traceback.format_exc()}"
                self._jobs[job_id]["updated_at"] = datetime.utcnow().isoformat()

    def get(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._jobs.get(job_id)
