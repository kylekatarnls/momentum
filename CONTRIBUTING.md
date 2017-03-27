# Contributing to Momentum

## Code of Conduct

Momentum is a non-profit project. That's why we ask you to be polite and respectful. For example, when you report an issue, please use human-friendly sentences ("Hello", "Please", "Thanks", etc.)

## Issue Contributions

Please report any security issue or risk by emailing momentum@selfbuild.fr. Please don't disclose security bugs publicly until they have been handled by us.

For any other bug or issue, please click this link and follow the template if applicable:
[Create new issue](https://github.com/kylekatarnls/momentum/issues/new?body=Hello%2C%0A%0AI%20encountered%20an%20issue%20with%20the%20following%20code%3A%0A%60%60%60js%0Avar%20momentum%20%3D%20new%20Momentum('Some%20example')%3B%0A%60%60%60%0A%0AI%20expected%20to%20get%3A%20...%0A%0ABut%20I%20actually%20get%3A%20...%0A%0AThanks!)

This template will help your provide us the informations we need for most issues (the code you use, the expected behaviour and the current behaviour).

## Code Contributions

Fork the [GitHub project](https://github.com/kylekatarnls/momentum) and chek out your copy locally:

```shell
git clone git@github.com:username/momentum.git
cd momentum
git remote add upstream git://github.com/kylekatarnls/momentum.git
```

Then, you can work on the master or create a specific branch for your development:

```shell
git checkout -b my-feature-branch -t origin/master
```

You can now edit the "momentum" directory contents.

Before committing, please set your name and your e-mail (use the same e-mail address as in your GitHub account):

```shell
git config --global user.name "Your Name"
git config --global user.email "your.email.address@example.com"
```

The ```--global``` argument will apply this setting for all your git repositories, remove it to set only the pug copy with them.

Now you can index and commit your modifications as you usually do with git:

```shell
git add --all
git commit -m "The commit message log"
```

If your patch fixes an open issue, please insert ```#``` immediately followed by the issue number:

```shell
git commit -m "#21 Fix this or that"
```

Use git rebase (not git merge) to sync your work from time to time:

```shell
git fetch upstream
git rebase upstream/master
```

Please add some tests for bug fixes and features (for a library such as file.js, add file.test.js, for a server-side file, add file.spec.js, both are written with jasmine.js syntax), then check all is right with `npm test`

Update dependencies:
```
./composer.phar update
```

Or if you installed composer globally:
```
composer update
```

Then call phpunit:
```
./vendor/bin/phpunit
```

Make sure all tests succeed before submit your pull-request, else we will not be able to merge it.

Push your work on your remote GitHub fork with:
```
git push origin my-feature-branch
```

Go to https://github.com/yourusername/pug and select your feature branch. Click the 'Pull Request' button and fill out the form.

We will review it within a few days. And we thank you in advance for your help.

## IDE

Momentum recommend you to use [<img src="http://jet-brains.selfbuild.fr/WebStorm-text.svg" width="100" height="13" alt="WebStorm">](https://www.jetbrains.com/webstorm/) to work on this project.
