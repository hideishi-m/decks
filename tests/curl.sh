#!/bin/bash

endpoint='http://127.0.0.1:6000'

function _() {
	echo "$@" >&2
	"$@"
}

function post() {
_ curl -s \
	-X POST \
	"${endpoint}/games" \
	-H 'Content-Type: application/json' \
	-d '{"players":["DEIRmen","Litzia","yuzuki"]}' \
	| jq
}

function get() {
_ curl -s \
	-X GET \
	"${endpoint}/games/0" \
	| jq

_ curl -s \
	-X GET \
	"${endpoint}/games/0/players/0" \
	| jq
}

function put() {
_ curl -s \
	-X PUT \
	"${endpoint}/games/0/players/0/draw" \
	| jq

_ curl -s \
	-X PUT \
	"${endpoint}/games/0/players/0/discard/2" \
	| jq

_ curl -s \
	-X PUT \
	"${endpoint}/games/0/players/0/recycle" \
	| jq

_ curl -s \
	-X PUT \
	"${endpoint}/games/0/players/0/pass/1/to/3" \
	| jq

_ curl -s \
	-X PUT \
	"${endpoint}/games/0/players/0/pick/3" \
	| jq
}

function delete() {
_ curl -s \
	-X DELETE \
	"${endpoint}/games/0" \
	| jq
}

post
get
put
#delete
