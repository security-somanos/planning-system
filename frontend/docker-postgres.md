# PostgreSQL Docker Setup

## Quick Start

Run PostgreSQL container:

```bash
docker run -d \
  --name planning-system-db \
  -e POSTGRES_USER=planning \
  -e POSTGRES_PASSWORD=planning123 \
  -e POSTGRES_DB=planning_system \
  -p 5423:5432 \
  -v planning-system-data:/var/lib/postgresql/data \
  postgres:16-alpine
```

## Connection Details

- **Host**: `localhost`
- **Port**: `5423`
- **Database**: `planning_system`
- **User**: `planning`
- **Password**: `planning123`

## Connection String

```
postgresql://planning:planning123@localhost:5423/planning_system
```

## Environment Variables

Set in your `.env` file:
```
DATABASE_URL=postgresql://planning:planning123@localhost:5423/planning_system
```

## Useful Commands

### Stop container
```bash
docker stop planning-system-db
```

### Start container
```bash
docker start planning-system-db
```

### Remove container (keeps data volume)
```bash
docker rm planning-system-db
```

### Remove container and data volume
```bash
docker rm -v planning-system-db
```

### View logs
```bash
docker logs planning-system-db
```

### Access PostgreSQL CLI
```bash
docker exec -it planning-system-db psql -U planning -d planning_system
```

