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
            var id = event.args[4];
            if (event.args[3].collection === 'people') {
                var name = event.args[3].item.name;
                people.push(name);

                return '<span title="' + id + '">' + name + ' added</span>\n';
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
        configField.value = config[0].value;
        changeConfigValue = function () {
            config[0].update({
                value: configField.value
            });
        };
        config.onUpdate(function (event) {
            if (event.item.counter === 1) {
                configField.value = event.update.$set.value;
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
