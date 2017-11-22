from www import app
from db import database, User, Feature, Project, Task
from flask import session, url_for, redirect, request, render_template, flash, jsonify
from flask_oauthlib.client import OAuth
from peewee import fn
import json
import config
import codecs
import datetime
import hashlib

oauth = OAuth()
openstreetmap = oauth.remote_app(
    'OpenStreetMap',
    base_url='https://api.openstreetmap.org/api/0.6/',
    request_token_url='https://www.openstreetmap.org/oauth/request_token',
    access_token_url='https://www.openstreetmap.org/oauth/access_token',
    authorize_url='https://www.openstreetmap.org/oauth/authorize',
    consumer_key=app.config['OAUTH_KEY'] or '123',
    consumer_secret=app.config['OAUTH_SECRET'] or '123'
)


@app.before_request
def before_request():
    database.connect()


@app.teardown_request
def teardown(exception):
    if not database.is_closed():
        database.close()


def get_user():
    if 'osm_uid' in session:
        return User.get(User.uid == session['osm_uid'])
    return None


def is_admin(user):
    return user and user.uid in config.ADMINS


@app.route('/')
def front():
    user = get_user()
    projects = Project.select().order_by(Project.updated.desc())
    return render_template('index.html', user=user, projects=projects,
                           admin=is_admin(user))


@app.route('/login')
def login():
    if 'osm_token' not in session:
        session['objects'] = request.args.get('objects')
        return openstreetmap.authorize(callback=url_for('oauth'))
    return redirect(url_for('front'))


@app.route('/oauth')
def oauth():
    resp = openstreetmap.authorized_response()
    if resp is None:
        return 'Denied. <a href="' + url_for('login') + '">Try again</a>.'
    session['osm_token'] = (
            resp['oauth_token'],
            resp['oauth_token_secret']
    )
    user_details = openstreetmap.get('user/details').data
    uid = int(user_details[0].get('id'))
    session['osm_uid'] = uid
    try:
        User.get(User.uid == uid)
    except User.DoesNotExist:
        User.create(uid=uid)
    return redirect(url_for('front'))


@openstreetmap.tokengetter
def get_token(token='user'):
    if token == 'user' and 'osm_token' in session:
        return session['osm_token']
    return None


@app.route('/logout')
def logout():
    if 'osm_token' in session:
        del session['osm_token']
    if 'osm_uid' in session:
        del session['osm_uid']
    return redirect(url_for('front'))


@app.route('/project/<name>')
def project(name):
    project = Project.get(Project.name == name)
    return render_template('project.html', project=project, admin=is_admin(get_user()))


@app.route('/browse/<project>')
def browse(project):
    project = Project.get(Project.name == project)
    query = Feature.select().where(Feature.project == project)
    features = []
    for f in query:
        features.append([f.ref, f.lon, f.lat, f.action])
    return render_template('browse.html', project=project, features=features)


@app.route('/run/<project>')
def tasks(project):
    if 'osm_uid' not in session:
        return redirect(url_for('front'))
    project = Project.get(Project.name == project)
    return render_template('task.html', project=project)


@app.route('/newproject')
@app.route('/editproject/<pid>')
def add_project(pid=None):
    user = get_user()
    if not is_admin(user):
        return redirect(url_for('front'))
    if pid:
        project = Project.get(Project.id == pid)
    else:
        project = Project()
    return render_template('newproject.html', project=project)


def update_features(project, features):
    curfeats = Feature.select(Feature).where(Feature.project == project)
    ref2feat = {f.ref: f for f in curfeats}
    deleted = set(ref2feat.keys())
    minlat = minlon = 180.0
    maxlat = maxlon = -180.0
    for f in features:
        data = json.dumps(f, ensure_ascii=False, sort_keys=True)
        md5 = hashlib.md5()
        md5.update(data.encode('utf-8'))
        md5_hex = md5.hexdigest()
        coord = f['geometry']['coordinates']
        if coord[0] < minlon:
            minlon = coord[0]
        if coord[0] > maxlon:
            maxlon = coord[0]
        if coord[1] < minlat:
            minlat = coord[1]
        if coord[1] > maxlat:
            maxlat = coord[1]
        if 'ref_id' in f['properties']:
            ref = f['properties']['ref_id']
        else:
            ref = '{}{}'.format(f['properties']['osm_type'], f['properties']['osm_id'])
        update = False
        if ref in ref2feat:
            deleted.remove(ref)
            feat = ref2feat[ref]
            if feat.feature_md5 != md5_hex:
                update = True
        else:
            feat = Feature(project=project, ref=ref)
            feat.validates_count = 0
            update = True
        if update:
            feat.feature = data
            feat.feature_md5 = md5_hex
            feat.lon = round(coord[0] * 1e7)
            feat.lat = round(coord[1] * 1e7)
            feat.action = f['properties']['action'][0]
            feat.save()
    if deleted:
        q = Feature.delete().where(Feature.ref << deleted)
        q.execute()
    project.bbox = ','.join([str(x) for x in (minlon, minlat, maxlon, maxlat)])
    project.feature_count = Feature.select().count()
    project.validated_count = Feature.select().where(Feature.validates_count >= 2).count()
    project.save()


@app.route('/newproject/upload', methods=['POST'])
def upload_project():
    def add_flash(pid, msg):
        flash(msg)
        return redirect(url_for('add_project', pid=pid))

    if not is_admin(get_user()):
        return redirect(url_for('front'))
    pid = request.form['pid']
    if pid:
        pid = int(pid)
        project = Project.get(Project.id == pid)
    else:
        pid = None
        project = Project()
        project.feature_count = 0
        project.validated_count = 0
        project.bbox = ''
    project.name = request.form['name'].strip()
    if not project.name:
        return add_flash(pid, 'Empty name - bad')
    project.title = request.form['title'].strip()
    if not project.title:
        return add_flash(pid, 'Empty title - bad')
    project.url = request.form['url'].strip()
    if not project.url:
        project.url = None
    project.description = request.form['description'].strip()
    project.can_validate = request.form.get('validate') is not None
    if 'json' not in request.files or request.files['json'].filename == '':
        if not pid:
            return add_flash(pid, 'Would not create a project without features')
        features = []
    else:
        try:
            features = json.load(codecs.getreader('utf-8')(request.files['json']))
        except ValueError as e:
            return add_flash(pid, 'Error in the uploaded file: {}'.format(e))
        if 'features' not in features or not features['features']:
            return add_flash(pid, 'No features found in the JSON file')
        features = features['features']

    project.updated = datetime.datetime.utcnow().date()
    project.save()

    if features:
        with database.atomic():
            update_features(project, features)

    if project.feature_count == 0:
        project.delete_instance()
        return add_flash('Zero features in the JSON file')

    return redirect(url_for('project', name=project.name))


@app.route('/delete/<int:pid>')
def delete_project(pid):
    if not is_admin(get_user()):
        return redirect(url_for('front'))
    project = Project.get(Project.id == pid)
    project.delete_instance(recursive=True)
    return redirect(url_for('front'))


@app.route('/export_audit/<int:pid>')
def export_audit(pid):
    if not is_admin(get_user()):
        return redirect(url_for('front'))
    project = Project.get(Project.id == pid)
    query = Feature.select(Feature.ref, Feature.audit).where(
        Feature.project == project, Feature.audit.is_null(False)).tuples()
    audit = {}
    for feat in query:
        if feat[1]:
            audit[feat[0]] = json.loads(feat[1])
    return app.response_class(
        json.dumps(audit, ensure_ascii=False), mimetype='application/json',
        headers={'Content-Disposition': 'attachment;filename=audit_{}.json'.format(project.name)})


@app.route('/api')
def api():
    return 'API Endpoint'


@app.route('/api/features/<int:pid>')
def all_features(pid):
    project = Project.get(Project.id == pid)
    query = Feature.select().where(Feature.project == project)
    features = []
    for f in query:
        features.append([f.ref, [f.lat/1e7, f.lon/1e7], f.action])
    return app.response_class('features = {}'.format(json.dumps(features, ensure_ascii=False)),
                              mimetype='application/javascript')


@app.route('/api/feature/<int:pid>', methods=['GET', 'POST'])
def api_feature(pid):
    user = get_user()
    project = Project.get(Project.id == pid)
    if user and request.method == 'POST':
        ref_and_audit = request.get_json()
        if ref_and_audit and len(ref_and_audit) == 2:
            feat = Feature.get(Feature.ref == ref_and_audit[0])
            if len(ref_and_audit[1]):
                new_audit = json.dumps(ref_and_audit[1], sort_keys=True, ensure_ascii=False)
            else:
                new_audit = None
            if feat.audit != new_audit:
                feat.audit = new_audit
                feat.validates_count = 1
            else:
                feat.validates_count += 1
                if feat.validates_count == 2:
                    project.validated_count += 1
                    project.save()
            feat.save()
    fref = request.args.get('ref')
    if fref:
        feature = Feature.get(Feature.ref == fref)
    elif not user or request.args.get('browse') == '1':
        feature = Feature.select().where(Feature.project == project).order_by(fn.Random()).get()
    else:
        try:
            # TODO: Select features inside user's bboxes first
            # Maybe use a join: https://stackoverflow.com/a/35927141/1297601
            task_query = Task.select(Task.id).where(Task.user == user, Task.feature == Feature.id)
            feature = Feature.select().where(
                Feature.project == project, Feature.validates_count < 2).where(
                    ~fn.EXISTS(task_query)).order_by(fn.Random()).get()
            Task.create(user=user, feature=feature)
        except Feature.DoesNotExist:
            feature = {'feature': 'null', 'ref': None, 'audit': None}
    return jsonify(feature=json.loads(feature.feature), ref=feature.ref, audit=feature.audit)
