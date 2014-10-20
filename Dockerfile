FROM       busybox
MAINTAINER Al Tobey <atobey@datastax.com>

RUN mkdir -p /srv/public
COPY cassandra-summit-cfp-review /srv/cassandra-summit-cfp-review
COPY public /srv/public
EXPOSE 8080
USER 1338
ENTRYPOINT ["/srv/cassandra-summit-cfp-review"]
