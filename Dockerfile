FROM       busybox
MAINTAINER Al Tobey <atobey@datastax.com>

# I had to `cp -r /etc/ssl .` for this to work
# the Go TLS client looks for /etc/ssl and requires it
# to check Mozilla's cert for Persona
COPY ssl /etc/ssl

COPY cassandra-summit-cfp-review /cassandra-summit-cfp-review
COPY public /public
EXPOSE 8080
USER 1336
ENTRYPOINT ["/cassandra-summit-cfp-review"]
