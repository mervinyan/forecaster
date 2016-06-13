var express = require('express');
var router = express.Router();

var numeral = require('numeral');

var utils = require('./utils.js');
var uuid = require('node-uuid');

router.get('/', function (req, res, next) {
    utils.fetch_projection_result('projection_cashflow',
        function (data) {
            var cashflow = [];
            for (var month in data.cashflow) {
                var cashflow_accounts = [];
                for (var account in data.cashflow[month]) {
                    var cashflow_account = {
                        "account": account,
                        "begin": numeral(data.cashflow[month][account].begin).format('$0,0.00'),
                        "in": numeral(data.cashflow[month][account].in).format('$0,0.00'),
                        "out": numeral(data.cashflow[month][account].out).format('$0,0.00'),
                        "end": numeral(data.cashflow[month][account].end).format('$0,0.00')
                    };
                    cashflow_accounts.push(cashflow_account);
                    cashflow_accounts.sort(function (a, b) {
                        return a.account.localeCompare(b.account);
                    });
                }
                cashflow.push({ "month": month, "accounts": cashflow_accounts });

            }
            cashflow.sort(function(a, b) {
                return b.month.localeCompare(a.month);
            });

            res.render('cashflow.pug', { title: 'Cashflow Forecast', 'cashflow': cashflow });

        },
        function () {
            res.render('cashflow.pug', { title: 'Cashflow Forecast', 'cashflow': [] });

        },
        function () {
            res.render('cashflow.pug', { title: 'Cashflow Forecast', 'cashflow': [] });

        });


});


module.exports = router;
