#!/bin/bash

GufenDir="/home/alex/gufen/gufenator.github.io"

DataBase="$GufenDir/streams.db"
OutputJS="$GufenDir/assets/js/data.js"
ServiceToken="533bacf01e11f55b536a565b57531ac114461ae8736d6506a3"

/usr/bin/python3 "$GufenDir/gufenator.py" -t "$ServiceToken" -d "$DataBase" -j "$OutputJS"
