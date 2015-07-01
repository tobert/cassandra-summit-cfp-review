FROM       debian:jessie
MAINTAINER Al Tobey <atobey@datastax.com>

RUN apt-get update && apt-get install -y ca-certificates
COPY cassandra-summit-cfp-review /cassandra-summit-cfp-review
COPY schema.cql /
COPY public /public
EXPOSE 8080
USER 1336
ENTRYPOINT ["/cassandra-summit-cfp-review"]
