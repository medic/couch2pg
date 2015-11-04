#!/bin/sh

DEMOSDIR=./demos
COUCHURL="http://localhost:5984"
COUCHDIR=`curl ${COUCHURL}/_config/couchdb/database_dir 2> /dev/null | sed s/\"//g`
echo "Found CouchDB at ${COUCHDIR}"

# fetch db snapshot
wget http://dev.medicmobile.org/downloads/temp/medic-demos-release-20151104.tar.xz
# set the expected output dir to DEMOSDIR
tar -xJf medic-demos-release-20151104.tar.xz
# turn off couchdb
sudo service couchdb stop
# copy couch databases over to the system
sudo cp ${DEMOSDIR}/* ${COUCHDIR}
# determine the couchdb unix user/group
COUCHOWNER=`ls -ld ${COUCHDIR} | awk '{print $3 ":" $4}'`
echo "Found CouchDB owner:group to be ${COUCHOWNER}"
# set the correct owner for the new files
sudo chown -R ${COUCHOWNER} ${COUCHDIR}
# start up couchdb
sudo service couchdb start
# this script will exit when couch is online
while [ ! `curl -f ${COUCHURL}` ]; do
  echo "Waiting for system to come up..."
  sleep 2
done
