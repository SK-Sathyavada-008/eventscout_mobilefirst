import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware

from eventscout.database.mongodb import EventDatabase
from eventscout.database.user_db import UserDatabase
from eventscout.models.event import Event
from api.auth import get_optional_current_user, get_current_user
from api.routers import auth as auth_router
from api.routers import users as users_router
from api.routers import saved_events as saved_events_router
from api.routers import notifications as notifications_router
from api.routers import sources as sources_router

logger = logging.getLogger("EventScoutAPI")

# Module-level singletons — one MongoDB connection reused for all requests
_event_db: Optional[EventDatabase] = None


def get_event_db() -> EventDatabase:
    """Returns the shared EventDatabase instance, creating it on first call."""
    global _event_db
    if _event_db is None:
        _event_db = EventDatabase()
        _event_db.get_collection()  # eagerly open connection at startup
    return _event_db



@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages API startup and shutdown tasks, including background scheduler and initial bundled event sync.
    """
    scheduler = None
    try:
        from eventscout.scheduler import EventScoutScheduler
        scheduler = EventScoutScheduler()
        scheduler.start(blocking=False)
        logger.info("Background EventScoutScheduler started with API lifespan.")
    except Exception as e:
        logger.warning("Could not auto-start EventScoutScheduler: %s", e)

    # Automatically sync verified bundled events into MongoDB Atlas on startup
    try:
        from eventscout.models.event import Event
        import json
        import os
        from datetime import datetime, timezone

        ev_db = get_event_db()
        json_candidates = [
            os.path.join(os.path.dirname(__file__), "..", "eventscout", "data", "events.json"),
            os.path.join(os.path.dirname(__file__), "..", "data", "events.json"),
            os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "fallback_events.json"),
        ]
        chosen_path = None
        for p in json_candidates:
            if os.path.exists(p):
                chosen_path = os.path.abspath(p)
                break

        if chosen_path:
            with open(chosen_path, "r", encoding="utf-8") as f:
                raw_events = json.load(f)
            event_objs = []
            for item in raw_events:
                try:
                    dt_str = item.get("date_time")
                    dt_val = None
                    if dt_str:
                        s = str(dt_str).strip()
                        if s.endswith("Z"):
                            s = s[:-1] + "+00:00"
                        dt_val = datetime.fromisoformat(s)
                    if not dt_val:
                        dt_val = datetime.now(timezone.utc)

                    ev_obj = Event(
                        title=item.get("title", "Untitled Event"),
                        event_url=item.get("event_url") or item.get("registration_url") or "",
                        date_time=dt_val,
                        organizer=item.get("organizer") or item.get("organization") or "Tech Community",
                        source=item.get("source") or "community",
                        mode=item.get("mode") or "online",
                        mode_location=item.get("mode_location") or "Online",
                        location=item.get("location"),
                        city=item.get("city"),
                        country=item.get("country"),
                        poster_image_url=item.get("poster_image_url"),
                        description=item.get("description"),
                        is_free=item.get("is_free", True),
                        price_amount=item.get("price_amount"),
                        price_currency=item.get("price_currency"),
                        source_event_id=item.get("source_event_id") or item.get("event_url"),
                        registration_url=item.get("registration_url") or item.get("event_url"),
                        is_technical=item.get("is_technical", True),
                        categories=item.get("categories") or ["Tech"],
                    )
                    event_objs.append(ev_obj)
                except Exception as ex_item:
                    logger.debug("Skipping item in seed sync: %s", ex_item)

            if event_objs:
                metrics = ev_db.upsert_events(event_objs)
                logger.info("Startup sync successfully loaded %d events into MongoDB: %s", len(event_objs), metrics)
    except Exception as e:
        logger.warning("Could not sync bundled events on startup: %s", e)

    yield

    if scheduler:
        try:
            scheduler.stop()
            logger.info("Background EventScoutScheduler stopped cleanly.")
        except Exception:
            pass



app = FastAPI(
    title="EventScout API",
    description="API to serve technical events from MongoDB for the EventScout platform.",
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS for local development frontend, installed PWA, and extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://eventscout-mobilefirst.vercel.app",
        "*"
    ],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth_router.router)
app.include_router(users_router.router)
app.include_router(saved_events_router.router)
app.include_router(notifications_router.router)
app.include_router(sources_router.router)


@app.get("/health", summary="Health Check")
async def health_check():
    """
    Returns a simple health check response to verify the API is running.
    """
    return {"status": "ok", "message": "EventScout API is running"}


class ExtensionSaveRequest(BaseModel):
    title: str
    event_url: str
    date_time: Optional[str] = None
    organizer: Optional[str] = "Web Discovery"
    description: Optional[str] = None
    mode: Optional[str] = None
    mode_location: Optional[str] = "Online"
    location: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    poster_image_url: Optional[str] = None
    is_free: Optional[bool] = True
    categories: Optional[List[str]] = None
    source: Optional[str] = "extension"
    source_event_id: Optional[str] = None


@app.post("/events/sync-bundled", summary="Synchronize verified bundled events into MongoDB Atlas")
async def sync_bundled_events():
    """
    Syncs the bundled events (including Hyderabad events like Google DevFest) into MongoDB Atlas.
    """
    from eventscout.models.event import Event
    import json
    import os
    from datetime import datetime, timezone

    db = get_event_db()
    json_candidates = [
        os.path.join(os.path.dirname(__file__), "..", "eventscout", "data", "events.json"),
        os.path.join(os.path.dirname(__file__), "..", "data", "events.json"),
        os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "fallback_events.json"),
    ]
    chosen_path = None
    for p in json_candidates:
        if os.path.exists(p):
            chosen_path = os.path.abspath(p)
            break

    if not chosen_path:
        raise HTTPException(status_code=404, detail="No bundled events file found.")

    with open(chosen_path, "r", encoding="utf-8") as f:
        raw_events = json.load(f)

    event_objs = []
    for item in raw_events:
        try:
            dt_str = item.get("date_time")
            dt_val = None
            if dt_str:
                s = str(dt_str).strip()
                if s.endswith("Z"):
                    s = s[:-1] + "+00:00"
                dt_val = datetime.fromisoformat(s)
            if not dt_val:
                dt_val = datetime.now(timezone.utc)

            ev_obj = Event(
                title=item.get("title", "Untitled Event"),
                event_url=item.get("event_url") or item.get("registration_url") or "",
                date_time=dt_val,
                organizer=item.get("organizer") or item.get("organization") or "Tech Community",
                source=item.get("source") or "community",
                mode=item.get("mode") or "online",
                mode_location=item.get("mode_location") or "Online",
                location=item.get("location"),
                city=item.get("city"),
                country=item.get("country"),
                poster_image_url=item.get("poster_image_url"),
                description=item.get("description"),
                is_free=item.get("is_free", True),
                price_amount=item.get("price_amount"),
                price_currency=item.get("price_currency"),
                source_event_id=item.get("source_event_id") or item.get("event_url"),
                registration_url=item.get("registration_url") or item.get("event_url"),
                is_technical=item.get("is_technical", True),
                categories=item.get("categories") or ["Tech"],
            )
            event_objs.append(ev_obj)
        except Exception as ex_item:
            logger.debug("Skipping item in seed sync: %s", ex_item)

    metrics = db.upsert_events(event_objs)
    return {
        "status": "success",
        "synced_file": chosen_path,
        "total_events": len(event_objs),
        "metrics": metrics,
    }


@app.get("/events", response_model=List[Dict[str, Any]], summary="Get upcoming technical events with search, filtering, and intelligent ranking")
async def get_events(
    q: Optional[str] = Query(None, description="Search term matching title, description, organizer, or skills"),
    category: Optional[str] = Query(None, description="Category filter"),
    event_type: Optional[str] = Query(None, description="Event type filter (e.g. hackathon, workshop, conference)"),
    mode: Optional[str] = Query(None, description="Mode filter (online, in-person, hybrid)"),
    city: Optional[str] = Query(None, description="City location filter"),
    location: Optional[str] = Query(None, description="Location category filter (hyderabad, india, usa, online, other)"),
    is_free: Optional[bool] = Query(None, description="Free events only (true/false)"),
    source: Optional[str] = Query(None, description="Source platform name"),
    skills: Optional[str] = Query(None, description="Comma-separated list of skills"),
    sort_by: str = Query("recommended", description="Sorting method: recommended, soonest, deadline, newest"),
    limit: Optional[int] = Query(None, ge=1, le=500, description="Max results to return"),
    skip: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user),
):
    """
    Retrieves active/future events from MongoDB Atlas with multi-criteria filtering,
    intelligent host & quality ranking, personalized recommendations for authenticated users,
    and sorting. Maintains 100% backward compatibility.
    """
    try:
        db = get_event_db()
        skill_list = [s.strip() for s in skills.split(",")] if skills else None
        events = db.query_events(
            q=q,
            category=category,
            event_type=event_type,
            mode=mode,
            city=city,
            location=location,
            is_free=is_free,
            source=source,
            skills=skill_list,
            sort_by=sort_by,
            user=current_user,
            limit=limit,
            skip=skip,
        )
        return events
    except Exception as e:
        logger.error("Failed to retrieve events from MongoDB: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Unable to load events from database: {str(e)}"
        )


@app.post("/events/extension-save", summary="Save an event detected by the browser extension")
async def save_event_from_extension(
    request: ExtensionSaveRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_current_user),
):
    """
    Receives event metadata extracted by the EventScout Chrome extension,
    upserts it into MongoDB, and bookmarks it for the current user if logged in.
    """
    from datetime import datetime, timezone
    from eventscout.utils.location_utils import normalize_event_location

    db = get_event_db()
    now_iso = datetime.now(timezone.utc).isoformat()
    dt_val = None
    if request.date_time:
        try:
            s = request.date_time.strip()
            if s.endswith("Z"):
                s = s[:-1] + "+00:00"
            dt_val = datetime.fromisoformat(s)
        except Exception:
            pass
    if not dt_val:
        dt_val = datetime.now(timezone.utc)

    loc_meta = normalize_event_location({
        "mode": request.mode,
        "mode_location": request.mode_location,
        "location": request.location or request.mode_location,
        "city": request.city,
        "country": request.country,
        "title": request.title,
        "event_url": request.event_url,
    })

    source_val = request.source or "extension"
    event_id_val = request.source_event_id or request.event_url

    event_obj = Event(
        title=request.title,
        event_url=request.event_url,
        date_time=dt_val,
        organizer=request.organizer or "Web Discovery",
        source=source_val,
        mode=loc_meta.get("mode") or request.mode or "online",
        mode_location=loc_meta.get("mode_location") or request.mode_location or "Online",
        location=loc_meta.get("location") or request.location or loc_meta.get("mode_location"),
        city=loc_meta.get("city") or request.city,
        country=loc_meta.get("country") or request.country,
        poster_image_url=request.poster_image_url,
        description=request.description,
        is_free=request.is_free if request.is_free is not None else True,
        categories=request.categories or ["General Tech"],
        source_event_id=event_id_val,
        registration_url=request.event_url,
        scraped_at=now_iso,
    )

    metrics = db.upsert_events([event_obj])
    
    # If user is authenticated, also save it to their saved_event_ids
    saved_for_user = False
    if current_user and "id" in current_user:
        user_db = UserDatabase()
        ev_doc = db.get_collection().find_one({"source": source_val, "source_event_id": event_id_val})
        if ev_doc:
            user_db.save_event(current_user["id"], str(ev_doc["_id"]))
            saved_for_user = True

    return {
        "status": "success",
        "message": "Event successfully saved to EventScout",
        "saved_for_user": saved_for_user,
        "metrics": metrics,
    }



if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)

