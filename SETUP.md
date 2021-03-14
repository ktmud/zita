# Install and Deploy

Getting Zita setup is easy. You can run it locally, deploy everything in a single Docker container,
or deploy different parts to multiple servers for better scalability.

## Getting Started

The Zita app consists of three parts:

- Label: where you label the data, provide ground truth about your images
- Train: in a short notebook, you can start training and tuning your image classifier. We recommend running this on a GPU powered machine.
- Predict: you can examine your model's predictions here.

### Install

Project dependencies are managed by `npm` and `Poetry`.
We recommend install everything from source code for easier future deployment:

```shell
git clone http://github.com/zillow/zita.git
cd zita
yarn
yarn start

cd python
pip3 install poetry
poetry install
```

### Update Configuration

You need to update the configuration to tell Zita where to load photos and store ground truth.

All configurations are set via environment variables:

| Env Variable    | Purpose                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------- |
| ZT_ALBUMS_ROOT  | Root folder of all your photos, with each subfolder being a photo album.                            |
| ZT_TAG_OPTIONS  | Tag choices for your photos. Keep it under 6 for best experience.                                   |
| ZT_TAG_OUTPUT   | The output destination of tagged photos information. Either a local JSON file or Redis destination. |
| ZT_API_ROOT     | API root to serve photos and graphql API. Normally "http://{your_host}/api".                        |
| ZT_SSR_API_ROOT | API root that the server side rendering uses.                                                       |

Simply create subfolders in `ZT_ALBUMS_ROOT` and put your photos in them.

### Label Images

Now you can start labeling your images. Take advantage of the convenient keyboard shortcuts. One person can easily
finish tagging 1000 photos in under 1 hour. And of course, you can also deploy Zita on a server so that a team
can start labeling the images at the same time.

To start labelling, you need to configure the label options in environment variables:

```bash
env `egrep -v '^#' .env | xargs` npm run dev
```

In which `.env` is the env file you created under the root folder of Zita
repository containing configurations such as where the photos are located:

For example, to classify MNIST dataset:j

```bash
ZT_ALBUMS_ROOT=/opt/data/MINST
ZT_TAG_OPTIONS="1||2||3||4||5||6||7||8||9||9"
```

By default it saves all tagging info under `ZT_ALBUMS_ROOT/tags.json`.

## Deploy

The simpliest way to ship Zita as a image classification service
is single-host deployment via [Dokku](http://dokku.viewdocs.io/dokku/).

Before we proceed, let's configure the SSH connections first so that Dokku command access can be easier:

Edit your local `~/.ssh/config`:

```sshconfig
Host du
    HostName [YOUR DOKKU SERVER HOST]
    User ubuntu
    IdentityFile ~/.ssh/dokku-manage.pem

Host dd
    HostName [YOUR DOKKU SERVER HOST]
    User dokku
    IdentityFile ~/.ssh/dokku-deploy.pem
```

Add alias to execute remote `dokku` commands on local machine:

```shell
alias dokku="ssh dd"
```

### Step 1: Create a Dokku App

You can execute the following commands either on your local machine or
on the Dokku host.

```bash
dokku apps:create zita

# Enable Redis storage if you like
dokku redis:create zita
dokku redis:link zita zita
```

To enable Redis, you must run this on the Dokku host:

```bash
sudo dokku plugin:install https://github.com/dokku/dokku-redis.git
```

Then add a photo storage folder to the Dokku app:

```shell
export PHOTOS_DIR=/var/lib/dokku/data/storage/zita
dokku storage:mount zita $PHOTOS_DIR:/app/data
```

and configure environment variables

```shell
# Put your configuration in a local envfile
export ENVFILE=.env.dokku
dokku config:set --no-restart zita `egrep -v '^#' $ENVFILE | xargs`

# Start the backend as well
dokku ps:scale zita backend=2
# Manually restart when needed
dokku ps:restart zita
```

See [Configurations](#configurations) for the full list of configure variables.

### Step 2: Upload Training Photos

Then, let's upload photos to the Dokku host.

Be sure to use the correct hostname and ssh keys.

Then upload photos with the following command
(it is somewhat trickier it should be as Dokku does not allow
directly `ssh dokku@host` without executing a Dokku command).

```shell
# On MacOS, install rsync 3 so we can have nice progress bar
# with --info=progress2
brew install rsync

export REMOTE_HOST=du
export REMOTE_STORAGE=/var/lib/dokku/data/storage/zita

# Update this to where you put the images
export LOCAL_FOLDER=/opt/data/photos

export DEST_DIRNAME=$(basename -- $LOCAL_FOLDER)

# temporarily set owner of remote storage to `ubuntu`
ssh $REMOTE_HOST sudo mkdir -p $REMOTE_STORAGE
ssh $REMOTE_HOST sudo chown ubuntu:dokku $REMOTE_STORAGE
# Clean up the remote directory
ssh $REMOTE_HOST sudo rm -r $REMOTE_STORAGE/$DEST_DIRNAME || true

# sync local fodler to remote storage
rsync -axhc --compress-level=9 --info=progress2 \
  -e "ssh -c aes128-ctr -T -o Compression=no -x" \
  $LOCAL_FOLDER $REMOTE_HOST:$REMOTE_STORAGE

# Revert the owner of remote storage
ssh $REMOTE_HOST sudo chown -R dokku:dokku $REMOTE_STORAGE/$DEST_DIRNAME
ssh $REMOTE_HOST sudo chown dokku:dokku $REMOTE_STORAGE
```

### Step 3: Deploy and Start Services

Now you can run `git push` to deploy.

```shell
git remote add d dd:zita
git push d
```

After deployment, you'd need to expose the ports of the running docker container
and scale up the `py` service.

```shell
dokku proxy:ports-add zita http:80:3000
dokku proxy:ports-add zita http:3001:3001
dokku ps:scale zita web=1 py=2
```

It is also recommended to set shorter CHECKS_WAIT time for the `py` service.

```shell
dokku config:set zita DOKKU_DEFAULT_CHECKS_WAIT=5
```

## Train and Deploy the Model

Once that the web UI is setup, you can start tagging some ground truth.
