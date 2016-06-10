fromCategory('account')
    .when({
        $init: function () {
            return {
                balances: {}
            }
        },
        "ActualImported": function (state, ev) {
            if (!state.balances[ev.body["account"]]) {
                state.balances[ev.body["account"]] = 0.00;
            }
            if (ev.body["transaction_type"] == "credit") {
                state.balances[ev.body["account"]] += parseFloat(ev.body["amount"]);
            }
            if (ev.body["transaction_type"] == "debit") {
                state.balances[ev.body["account"]] -= parseFloat(ev.body["amount"]);
            }
        }
    });
