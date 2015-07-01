CREATE KEYSPACE ccfp WITH REPLICATION = { 'class' : 'SimpleStrategy', 'replication_factor' : 1 };

use ccfp;

CREATE TABLE abstracts (
    id           uuid,
	title        text,
    body         text,
    created      timestamp,
    authors      map<text,text>,
    tags         set<text>,
	company      text,
	jobtitle     text,
	picture_link text,
	bio          text,
	audience     text,
	scores_a     map<text,float>,
	scores_b     map<text,float>,
	scores_c     map<text,float>,
	scores_d     map<text,float>,
	scores_e     map<text,float>,
	scores_f     map<text,float>,
	scores_g     map<text,float>,
	scores_names map<text,text>,
    PRIMARY KEY(id)
);

CREATE TABLE comments (
    abstract_id uuid,
    id           timeuuid,
	email        text,
    body         text,
    PRIMARY KEY(abstract_id, id)
);

CREATE TABLE abstract_email_index (
    email text,
	abstracts set<uuid>,
	comments set<uuid>,
	PRIMARY KEY(email)
);

CREATE TABLE abstract_tag_index (
    tag text,
	abstracts set<uuid>,
	comments set<uuid>,
	PRIMARY KEY(tag)
);

CREATE TABLE sessions (
	id       uuid,
	email    text,
	created  timestamp,
	modified timestamp,
	PRIMARY KEY(id)
);
