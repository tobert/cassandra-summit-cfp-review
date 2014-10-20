FROM       busybox
MAINTAINER Al Tobey <atobey@datastax.com>

COPY cassandra-summit-cfp-review /cassandra-summit-cfp-review
COPY public /public
EXPOSE 8080
USER 1336
ENTRYPOINT ["/cassandra-summit-cfp-review"]
