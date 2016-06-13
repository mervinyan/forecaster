var http = require('http');

var ges = require('ges-client');
var uuid = require('node-uuid');

var moment = require('moment');

module.exports = {


    fetch_projection_result: function (projection_name, callback_1, callback_2, callback_3) {
        var options1 = {
            host: 'localhost',
            port: 2113,
            path: '/projection/' + projection_name + '/result',
            method: 'GET'
        }

        http.request(options1, function (res1) {
            if (res1.statusCode == 200) {
                res1.setEncoding('utf8');
                var body = "";
                res1.on('data', function (chunk) {
                    body += chunk;
                });
                res1.on('end', function () {
                    if (body.trim().length > 0) {
                        var data = JSON.parse(body);
                        callback_1(data);
                    } else {
                        callback_2();
                    }

                });
            } else {
                callback_3();
            }
        }).end();
    },

    fetch_events_backwards: function (stream, start, count, resolveLinkTos, resultProcessor) {
        console.log(resolveLinkTos);
        var connection = ges({ host: '127.0.0.1' });
        connection.on('connect', function () {
            console.log('connecting to geteventstore...');
            connection.readStreamEventsBackward(stream, { start: start, count: count, resolveLinkTos: resolveLinkTos }, function (err, readResult) {
                if (err) return console.log('Ooops!', err);
                // console.log(readResult);
                resultProcessor(readResult);
            });
        });
    },

    process: function (req, res, requestValidator, streamIdGenerator, eventDataExtractor) {
        var errors = requestValidator(req);
        if (errors) {
            res.json({ flash: { type: 'alert-danger', messages: errors } });
        } else {
            var stream = streamIdGenerator(req);
            var events = eventDataExtractor(req);
            // console.log(events);
            var connection = ges({ host: '127.0.0.1' });
            connection.on('connect', function () {
                console.log('connecting to geteventstore...');
                connection.readStreamEventsBackward(stream, { start: -1, count: 1, resolveLinkTos: true }, function (err, readResult) {
                    if (err) return console.log('Ooops!', err);
                    var expectedVersion = readResult.LastEventNumber;
                    var appendData = {
                        expectedVersion: expectedVersion,
                        events: events
                    };
                    // console.log(appendData);
                    connection.appendToStream(stream, appendData, function (err, appendResult) {
                        if (err) return console.log('Oops!', err);
                        res.json(appendResult);
                    });

                });
            });
        }
    },


    bin2String: function (array) {
        var result = "";
        for (var i = 0; i < array.length; i++) {
            result += String.fromCharCode(array[i]);
        }
        return result;
    },

    calculate_dates: function (start, count, step, unit) {
        var dates = [];
        dates.push(moment(start));
        if (step < 15) {
            for (var i = 1; i < count; i++) {
                dates.push(moment(start).add(step * (i), unit));
            }
        } else {
            if (moment(start).date() <= 13) {
                for (var i = 1; i < count; i++) {
                    if (i % 2 == 0) {
                        dates.push(moment(start).add(Math.floor(i / 2), 'months'));
                    } else {
                        dates.push(moment(start).add(Math.floor(i / 2), 'months').add(15, 'days'));
                    }
                }
            } else {
                for (var i = 1; i < count; i++) {
                    if (i % 2 == 1) {
                        if (moment(start).date() <= 15) {
                            dates.push(moment(start).add(Math.floor((i + 1) / 2), 'months').subtract((moment(start).date() - 1), 'days'));
                        } else {
                            dates.push(moment(start).add(Math.floor((i + 1) / 2), 'months').subtract(15, 'days'));
                        }
                    } else {
                        dates.push(moment(start).add(Math.floor((i + 1) / 2), 'months'));
                    }
                }
            }
        }

        return dates;
    },

    calculate_dates_until: function (start, end, step, unit) {
        var dates = [];
        dates.push(moment(start));
        if (step < 15) {
            var i = 1;
            while (moment(start).add(step * (i), unit) <= moment(end)) {
                dates.push(moment(start).add(step * (i), unit));
                i++;
            }
        } else {
            if (moment(start).date() <= 13) {
                var i = 1;
                var next_date = (i % 2 == 0) ? moment(start).add(Math.floor(i / 2), 'months') : moment(start).add(Math.floor(i / 2), 'months').add(15, 'days');
                while (next_date < moment(end)) {
                    dates.push(moment(next_date));
                    i++;
                    next_date = (i % 2 == 0) ? moment(start).add(Math.floor(i / 2), 'months') : moment(start).add(Math.floor(i / 2), 'months').add(15, 'days');
                }
            } else {
                var i = 1;
                var next_date = (i % 2 == 0) ? moment(start).add(Math.floor((i + 1) / 2), 'months') : (moment(start).date() <= 15 ? moment(start).add(Math.floor((i + 1) / 2), 'months').subtract((moment(start).date() - 1), 'days') : moment(start).add(Math.floor((i + 1) / 2), 'months').subtract(15, 'days'));
                while (next_date < moment(end)) {
                    dates.push(moment(next_date));
                    i++;
                    next_date = (i % 2 == 0) ? moment(start).add(Math.floor((i + 1) / 2), 'months') : (moment(start).date() <= 15 ? moment(start).add(Math.floor((i + 1) / 2), 'months').subtract((moment(start).date() - 1), 'days') : moment(start).add(Math.floor((i + 1) / 2), 'months').subtract(15, 'days'));
                }
            }
        }

        return dates;
    },

}






