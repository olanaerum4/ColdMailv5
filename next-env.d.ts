{
  "crons": [
    {
      "path": "/api/send/process",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/inbox",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/warmup",
      "schedule": "0 * * * *"
    }
  ]
}
