#!/bin/csh -f
#
# App to start baseX for Colenso project assignment

echo "Hello ${USER}, I'm about to start baseX with Colenso files"
./basex/bin/basexserver -d -c"CREATE DATABASE Colenso ./Colenso"
