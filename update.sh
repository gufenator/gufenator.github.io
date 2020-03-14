#!/bin/bash

GufenFolder="/home/alex/gufen"
SiteFolder="${GufenFolder}/gufenator.github.io"
ServiceToken="533bacf01e11f55b536a565b57531ac114461ae8736d6506a3"

cd "${SiteFolder}"

/usr/bin/python3 "${SiteFolder}/gufenator.py" \
	-t "${ServiceToken}" \
	-d "${GufenFolder}/streams.db" \
	-j "${SiteFolder}/assets/js/data.js" \
	-i "${SiteFolder}/index.html"

if [ "`git --git-dir=${SiteFolder}/.git --work-tree=${SiteFolder} status -s ${SiteFolder}/assets/js/data.js`" == " M assets/js/data.js" ]
then
	git --git-dir=${SiteFolder}/.git --work-tree=${SiteFolder} commit -a -m "Update data.js"
	git --git-dir=${SiteFolder}/.git --work-tree=${SiteFolder} push origin master
fi

