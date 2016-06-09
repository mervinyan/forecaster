fromCategory('account')
    .when({
        $init: function () {
            return {
                accounts: {}
            };
        },
        "AccountCreated": function (state, ev) {
            state.accounts[ev.body.mint_account_name] = ev.body.account_name;

        },
    })