from peewee import (
    fn, Model, CharField, IntegerField, ForeignKeyField,
    TextField, FixedCharField, BooleanField, DateField
)
from playhouse.migrate import (
    migrate as peewee_migrate,
    SqliteMigrator,
    MySQLMigrator,
    PostgresqlMigrator
)
from playhouse.db_url import connect
import config

database = connect(config.DATABASE_URI)
if 'mysql' in config.DATABASE_URI:
    fn_Random = fn.Rand
else:
    fn_Random = fn.Random


class BaseModel(Model):
    class Meta:
        database = database


class Project(BaseModel):
    name = CharField(max_length=32, index=True, unique=True)
    title = CharField(max_length=250)
    description = TextField()
    url = CharField(max_length=1000, null=True)
    feature_count = IntegerField()
    can_validate = BooleanField()
    bbox = CharField(max_length=60)
    updated = DateField()


class Feature(BaseModel):
    project = ForeignKeyField(Project, index=True, related_name='features', on_delete='CASCADE')
    ref = CharField(max_length=250, index=True)
    lat = IntegerField()  # times 1e7
    lon = IntegerField()
    action = FixedCharField(max_length=1)
    feature = TextField()
    feature_md5 = FixedCharField(max_length=32)
    audit = TextField(null=True)
    validates_count = IntegerField(default=0)


class User(BaseModel):
    uid = IntegerField(primary_key=True)
    bboxes = TextField(null=True)


class Task(BaseModel):
    user = ForeignKeyField(User, index=True, related_name='tasks')
    feature = ForeignKeyField(Feature, index=True, on_delete='CASCADE')


LAST_VERSION = 0


class Version(BaseModel):
    version = IntegerField()


def migrate():
    database.create_tables([Version], safe=True)
    try:
        v = Version.select().get()
    except Version.DoesNotExist:
        database.create_tables([User, Project, Feature, Task], safe=True)
        v = Version(version=LAST_VERSION)
        v.save()

    if v.version >= LAST_VERSION:
        return

    if 'mysql' in config.DATABASE_URI:
        migrator = MySQLMigrator(database)
    elif 'sqlite' in config.DATABASE_URI:
        migrator = SqliteMigrator(database)
    else:
        migrator = PostgresqlMigrator(database)

    if v.version == 0:
        peewee_migrate(
            # TODO
            migrator.add_column(User._meta.db_table, User.lang.name, User.lang)
        )
        v.version = 1
        v.save()

    if v.version != LAST_VERSION:
        raise ValueError('LAST_VERSION in db.py should be {}'.format(v.version))
