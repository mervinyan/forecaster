var express = require('express');
var router = express.Router();

var http = require('http');

var ges = require('ges-client');
var uuid = require('node-uuid');

var moment = require('moment');

var numeral = require('numeral');

router.get('/', function (req, res, next) {
    var options1 = {
        host: 'localhost',
        port: 2113,
        path: '/projection/projection_account_info/result',
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
                var data = JSON.parse(body);
                var accounts = [];
                for (var account in data.accounts) {
                    if (data.accounts[account].status == "Active") {
                        accounts.push(account);
                    }
                }
                res.render('forecasts.pug', { title: 'Forecasts', 'accounts': accounts });
            });
        } else {
            res.render('forecasts.pug', { title: 'Forecasts', 'accounts': [] });
        }
    }).end();
});

router.get('/fetch', function (req, res, next) {
    fetch_events_backwards('forecasted_transactions', -1, 1000, true, function (readResult) {
        var forecasted_transactions = [];
        for (var i = 0; i < readResult.Events.length; i++) {
            var event = readResult.Events[i].Event;
            var eventDataStr = bin2String(readResult.Events[i].Event.Data.toJSON().data)
            var eventData = JSON.parse(eventDataStr);
            var amount = numeral(eventData.amount).format('$0,0.00');
            if (event.EventType == 'IncomeForecastAdded') {
                forecasted_transactions[i] = { date: eventData.date, account: eventData.account, amount: amount, from: eventData.from, type: eventData.type, to: "", for: "", category: "" };
            } else if (event.EventType =='ExpenseForecastAdded') {
                forecasted_transactions[i] = { date: eventData.date, account: eventData.account, amount: amount, to: eventData.to, for: eventData.for, category: eventData.category, from: "", type: "" };
            }
        }
        
        forecasted_transactions.sort(sort_by_date);

        res.json({ "data": forecasted_transactions });
    });
});

router.post('/add', function (req, res, next) {
    process(req, res,
        function (req) {
            req.checkBody('date', 'Date is required').notEmpty().isDate();
            req.checkBody('account', 'Account is required').notEmpty();
            req.checkBody('amount', 'Amount is required').notEmpty().isDecimal();
            req.checkBody('type', 'Type is required').notEmpty();
            if (req.body.type == 'income') {
                req.checkBody('from', 'From is required').notEmpty();
                req.checkBody('income_type', 'Income Type is required').notEmpty();
            } else if (req.body.type == 'expense') {
                req.checkBody('to', 'To is required').notEmpty();
                req.checkBody('for', 'For is required').notEmpty();
                req.checkBody('category', 'Category is required').notEmpty();
            }
            if (req.body.recurring == 'yes') {
                req.checkBody('frequency', 'Frequency is required').notEmpty();
                if (req.body.frequency == 'Semi-Monthly') {
                    if (moment(req.body.date).date() > 28) {

                    }
                }
                // req.checkBody('starts', 'Starts is required').notEmpty().isDate();
                req.checkBody('endOptions', 'endOptions is required').notEmpty();
                if (req.body.endOptions == 'after') {
                    req.checkBody('occurrences', 'Occurrences is required').notEmpty().isInt();
                } else if (req.body.endOptions == 'on') {
                    req.checkBody('ends', 'Ends is required').notEmpty().isDate();
                }
            }
            var errors = req.validationErrors();
            return errors;

        },
        function (req) {
            return "account-" + req.body.account.toLowerCase().replace(/ /g, "_");
        },
        function (req) {
            var dates = [];
            var start = moment(req.body.date);
            if (req.body.recurring == 'yes') {
                var step = 0;
                var unit = '';
                if (req.body.frequency == 'Bi-Weekly') {
                    step = 14;
                    unit = 'days';
                }
                if (req.body.frequency == 'Semi-Monthly') {
                    step = 15;
                    unit = 'days';
                }
                if (req.body.frequency == 'Monthly') {
                    step = 1;
                    unit = 'months';
                }
                if (req.body.frequency == 'Yearly') {
                    step = 1;
                    unit = 'years';
                }

                if (req.body.endOptions == 'after') {
                    var count = parseInt(req.body.occurrences);
                    dates = calculate_dates(start, count, step, unit);
                } else if (req.body.endOptions == 'on') {
                    dates = calculate_dates_until(start, moment(req.body.ends), step, unit);
                }
            } else {
                dates.push(start);
            }

            console.log(dates);
            var eventType = "";
            if (req.body.type == 'income') {
                eventType = "IncomeForecastAdded";
            } else {
                eventType = "ExpenseForecastAdded";
            }
            var events = [];
            for (var i = 0; i < dates.length; i++) {
                var eventData = {};
                if (req.body.type == 'income') {
                    eventData = {
                        'account': req.body.account,
                        'from': req.body.from,
                        'amount': req.body.amount,
                        'type': req.body.type,
                        'date': dates[i].format('YYYY-MM-DD')
                    };
                } else {
                    eventData = {
                        'account': req.body.account,
                        'to': req.body.to,
                        'for': req.body.for,
                        'amount': req.body.amount,
                        'category': req.body.category,
                        'date': dates[i].format('YYYY-MM-DD')
                    };
                }
                events.push(
                    {
                        'EventId': uuid.v4(),
                        'Type': eventType,
                        'Data': new Buffer(JSON.stringify(eventData)),
                        'IsJson': true
                    }
                );
            }

            return events;
        }
    );
});

function fetch_events_backwards(stream, start, count, resolveLinkTos, resultProcessor) {
    console.log(resolveLinkTos);
    var connection = ges({ host: '127.0.0.1' });
    connection.on('connect', function () {
        console.log('connecting to geteventstore...');
        connection.readStreamEventsBackward(stream, { start: start, count: count, resolveLinkTos: resolveLinkTos }, function (err, readResult) {
            if (err) return console.log('Ooops!', err);
            console.log(readResult);
            resultProcessor(readResult);
        });
    });
}

function process(req, res, requestValidator, streamIdGenerator, eventDataExtractor) {
    var errors = requestValidator(req);
    if (errors) {
        res.json({ flash: { type: 'alert-danger', messages: errors } });
    } else {
        var stream = streamIdGenerator(req);
        var events = eventDataExtractor(req);
        console.log(events);
        append_events_to_stream(stream, events, function (appendResult) {
            res.json(appendResult);
        })
    }
}

function append_events_to_stream(stream, events, callback) {
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
            console.log(appendData);
            connection.appendToStream(stream, appendData, function (err, appendResult) {
                if (err) return console.log('Oops!', err);
                callback(appendResult);
            });

        });
    });
}

function bin2String(array) {
    var result = "";
    for (var i = 0; i < array.length; i++) {
        result += String.fromCharCode(array[i]);
    }
    return result;
}

function sort_by_date(a, b) {
    return b.date.localeCompare(a.date);
}

function calculate_dates(start, count, step, unit) {
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
}

function calculate_dates_until(start, end, step, unit) {
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
}


module.exports = router;
