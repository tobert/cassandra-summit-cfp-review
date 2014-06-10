Cassandra Summit CFP Reviews
============================

Built with Go & Cassandra, inspired by @obfuscurity's Judy.

![main](https://raw.githubusercontent.com/tobert/cassandra-summit-cfp-review/master/screenshots/cfp-screenshot-mainscreen.jpg)
![abstract](https://raw.githubusercontent.com/tobert/cassandra-summit-cfp-review/master/screenshots/cfp-screenshot-scoring.jpg)

TODO
====

The data model isn't ideal. I threw it together before starting on the UI and charged through
without changing it much to see how it would work out. It works for the most part but a few
primary fields ended up in "attributes" which isn't idea.

Use appropriate HTTP response codes for each error. Most are either 500 or 400 right now, which is
not accurate.

License
=======

Apache 2.0
