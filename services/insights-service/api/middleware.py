import logging
import time
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("insights")


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] [req=%(request_id)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Injects a request_id into every request and response.

    Reads X-Request-Id from inbound headers (so callers can trace end-to-end)
    or generates a new UUID4 if absent.  The id is exposed via request.state
    and echoed back in X-Request-Id on the response.

    Deliberately avoids logging any patient data — only method, path, status,
    and duration are recorded.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.perf_counter()
        response: Response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000)

        response.headers["X-Request-Id"] = request_id

        # Use a LogRecord extra so the formatter can pick up request_id.
        # Never log request bodies — they contain clinical data.
        logging.getLogger("insights.access").info(
            "%s %s -> %s (%dms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={"request_id": request_id},
        )

        return response
