Cassandra Summit CFP Reviews
============================

Built with Go & Cassandra, inspired by @obfuscurity's Judy.

TODO
====

UI work. Lots of it.

Mostly I don't think the current auth setup is working correctly. It's close
but not correct yet.

the userEmail field is populated asyncronously after the login is processed. This can cause problems
when the user tries to do something too quickly. Need to add some way to block actions until it's ready or
come up with a better way to keep the email address state around.

Use appropriate HTTP response codes for each error. Most are either 500 or 400 right now, which is
not accurate.

License
=======

Apache 2.0
