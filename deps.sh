#!/bin/bash

set -e
set -x

go get github.com/gocql/gocql
go get github.com/gorilla/securecookie
go get github.com/gorilla/sessions

