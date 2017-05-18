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
    stop = momentum.on(function (event) {
        var id = event.args[4];
        if (event.args[1].collection === 'people') {
            var name = event.args[1].item.name;
            people.push(name);

            document.getElementById('log').innerHTML += '<span title="' + id + '">' + name + ' added</span>\n';
        }
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
        var firstCounter = config[0];
        configField.value = firstCounter.value;
        changeConfigValue = function () {
            firstCounter.set({
                value: configField.value
            });
        };
        firstCounter.onUpdate(function (event) {
            configField.value = event.update.$set.value;
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
