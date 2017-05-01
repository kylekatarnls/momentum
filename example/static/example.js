var momentum = new Momentum();
var people = [];
var setPeople = function (newPeople) {
    people = newPeople.sort();
    document.getElementById('people').innerHTML = JSON.stringify(people);
};
var changeConfigValue = function () {};
var stop = function () {};
var start = function () {
    stop();
    stop = momentum.on(function (events) {
        document.getElementById('log').innerHTML += events.map(function (event) {
            var id = event.args.pop();
            if (event.args[3] === 'people') {
                people.push(event.args[4].name);

                return '<span title="' + id + '">' + event.args[4].name + ' added</span>\n';
            }

            return '';
        }).join('');
        setPeople(people);
    });
};
var add = function () {
    var name = document.getElementById('name').value;
    momentum.insertOne(['people', {name: name}]);
};
momentum.onReady(function () {
    var configField = document.getElementById('config');
    momentum.getCollection('exampleConfig', function (config) {
        if (!config.length) {
            config.insertOne({
                counter: 1,
                value: ''
            });
        }
        changeConfigValue = function () {
            config[0].update({
                value: configField.value
            });
        };
        config.onChange(function (event, item, id, method, result, collection, copy, update) {
            if (method === 'updateOne' && item.counter === 1 && typeof update.value === 'string') {
                configField.value = update.value;
            }
        });
    });
    document.getElementById('status').innerHTML = 'ready';
    momentum.listenCollection('people');
    momentum.find(['people'], function (data) {
        setPeople(data.result.map(function (person) {
            return person.name;
        }));
    });
    start();
});
