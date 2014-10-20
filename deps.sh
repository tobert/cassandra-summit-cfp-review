#!/bin/bash

set -e
set -x

go get -u github.com/gocql/gocql
go get -u github.com/gorilla/securecookie
go get -u github.com/gorilla/sessions
go get -u github.com/gorilla/mux

