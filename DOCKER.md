# Docker Commands for local setup

- `cd master && docker build -t shardfs-master . `
- `cd worker && docker build -t shardfs-worker . `

### Create Custom Docker Network

- `docker network create shardnet`

## Run Local Images (detached mode -d)

- `docker run -d --name master --network shardnet -p 9000:9000 -e PORT=9000 shardfs-master`

- `docker run -d --name worker1 --network shardnet  -e PORT=8000 -e MASTER_URL=http://master:9000  shardfs-worker`

- `use -it instead of -d to see logs of container`

# Docker Commands for using published images

- `docker pull piyushm1501/shardfs-master && docker tag piyushm1501/shardfs-master shardfs-master`

- `docker pull piyushm1501/shardfs-worker && docker tag piyushm1501/shardfs-worker shardfs-worker`

- `docker network create shardnet`

- `docker run -d --name master --network shardnet -p 9000:9000 -e PORT=9000 shardfs-master`

- `docker run -d --name worker1 --network shardnet  -e PORT=8000 -e MASTER_URL=http://master:9000  shardfs-worker`


