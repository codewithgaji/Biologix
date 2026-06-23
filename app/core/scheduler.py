from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler() # This scheduler will be used to run background jobs, such as purging old archives.