var express = require('express');
var multer = require('multer');
var router = express.Router();

var uploading = multer();
router.use(uploading.single('file'));

var cheerio = require('cheerio');
var basex = require('basex');
var client = new basex.Session("127.0.0.1", 1984, "admin", "admin");

client.execute("OPEN Colenso");

//Edited doc with explanations from lecture 3 notes.
// The initial database check, confirms opening of Database.
// Roman tutorial add below, from sheet.

client.execute("XQUERY declare default element namespace 'http://www.tei-c.org/ns/1.0'; " +
    "//name[@type = 'place' and position() = 1 and . = 'Manawarakau']",
    function(err,res) { if(!err) console.log(res.result)} );

router.get("/",function(req,res) {
    res.render('index', {title: 'Colenso Database'});
});



// Returns all files for rendering to the browse tab.
router.get("/browse",function(req,res) {

    var queries = req.query;
    var path = "";
    var depth = 0;
    // Returns path of Colenso database on system.
    if (queries.path != undefined) {
        path = queries.path;
        depth = path.split('/').length;
        path = path + '/';
    }
    // anon function returning files, they are split in an array and passed to 'browse for rendering.'

    client.execute("XQUERY for $p in collection('Colenso/" + path + "') return db:path($p)",
        function (error, result) {
            if (error) {
                console.error(error);
            } else {
                var results = result.result.split('\n');
                var folders = [];
                var files = [];
                // push() function adds element to end of array here.
                for (var i = 0; i < results.length; i += 1) {
                    if (results[i].split('/')[depth].indexOf('.xml') < 0) {
                        folders.push(path + results[i].split('/')[depth]);
                    } else {
                        files.push(results[i].split('/')[depth]);
                    }
                }

                var unique_folders = [];

                for (var i = 0; i < folders.length; i += 1) {
                    if (unique_folders.indexOf(folders[i]) < 0) {
                        unique_folders.push(folders[i]);
                    }
                }
                res.render('browse', {title: 'Colenso Database', path: path, folders: unique_folders, files: files});
            }
    })
});





router.post('/upload', function(req, res){
    var queries = req.query;

    if(req.file){
        var path = queries.path + req.file.originalname;

        var file = req.file.buffer.toString();
        client.execute('ADD TO ' + path + ' "' + file + '"', function(error, result){
            if(error){
                console.error(error);
            }
        });
    } else {
        console.log('no file?');
    }

    if (queries.path) {
        res.redirect('browse/?path=' + queries.path.substring(0, queries.path.length - 1));
    } else {
        res.redirect('browse');
    }
});

//String search to query Colenso database.
router.get('/search1', function(req, res) {
    var queries = req.query;
    var result_paths;

    // required for scenario one. Adding to include logical operators.

    var query = queries.query.replace(" and ", "' ftand '");
        query = query.replace(" AND ", "' ftand '");
        query = query.replace(" or ", "' ftor '");
        query = query.replace(" OR ", "' ftor '");
        query = query.replace(" not ", "' ftnot '");
        query = query.replace(" NOT ", "' ftnot '");

    client.execute("XQUERY declare default element namespace 'http://www.tei-c.org/ns/1.0'; " +
        "for $p in *[.//text() contains text '" + query + "' using wildcards] return db:path($p)",
        function(error, result) {
            result_paths = result.result.split('\n');
        });

    client.execute("XQUERY declare default element namespace 'http://www.tei-c.org/ns/1.0'; " +
        "*[.//text() contains text '" + query + "' using wildcards]",
        function(error, result) {
            if(error){
                console.error(error);
            } else {
                var $ = cheerio.load(result.result);
                var search_result = [];
                //place is the position to find the next ten to be returned
                var place = parseInt(queries.place);
                $('TEI').each(function(index, element){
                    if(index >= place - 1 && index < place + 9) {
                        var elem = cheerio(element);
                        search_result.push({
                            title: elem.find('title').first().text(),
                            author: elem.find('author').first().text(),
                            date: elem.find('date').first().text(),
                            path: result_paths[index]
                        });
                    }
                });


                var last = place + 9 < $('TEI').length ? place + 9 : $('TEI').length;
                res.render('search', {title: 'search', search: queries.query, search_result: search_result,
                    first: place, prev: place - 10,
                    last: last, next: place + 10, total: $('TEI').length});
            }
        }
    )
});

// Return a file based on address, eg 'Colenso/private_letters/PrL-002111.xml'
router.get('/view', function(req, res) {

    var queries = req.query;

    client.execute("XQUERY doc ('Colenso/" + queries.path + "')",
        function(error, result) {
            if(error){
                console.error(error);
            } else {
                res.render('view', {title: 'Colenso Database', search_result: result.result, path: queries.path});
            }
        }
    )
});

router.get('/download', function(req, res) {
    var queries = req.query;
    var fullpath  = queries.path.split('/');
    var filename = fullpath[fullpath.length - 1];
    client.execute("XQUERY doc ('Colenso/" + queries.path + "')",
        function(error, result) {
            if(error){
                console.error(error);
            } else {
                var doc = result.result;

                //response.writeHead(statusCode[, statusMessage][, headers])#
                //Sends a response header to the request. The status code is a 3-digit HTTP status code,
                //like 404. The last argument, headers, are the response headers. Optionally one can give a human-readable
                //statusMessage as the second argument.

                res.writeHead(200, {
                    'Content-Disposition': 'attachment; filename=' + filename
                });
                res.write(doc);
                res.end();            }
        }
    )
});

// Returns query
router.post("/submit",function(req,res){
    var queries = req.query;
    client.replace(queries.path, req.body.text,
        function(error, result) {
            if(error) {
                console.error(error);
            } else {
                res.render('edit', {title: 'changes saved', search_result: req.body.text, path: queries.path});
            }
        }
    )
});

// Returns query for render
router.get('/edit', function(req,res) {
    var queries = req.query;
    client.execute("XQUERY doc ('Colenso/" + queries.path + "')",
        function(error, result) {
            if(error) {
                console.error(error);
            } else {
                res.render('edit', {title: 'Colenso Database', search_result: result.result, path: queries.path});
            }
        }
    )
});




module.exports = router;
