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


class User(BaseModel):
    uid = IntegerField(primary_key=True)
    admin = BooleanField(default=False)
    bboxes = TextField(null=True)


class Project(BaseModel):
    name = CharField(max_length=32, index=True, unique=True)
    title = CharField(max_length=250)
    description = TextField()
    url = CharField(max_length=1000, null=True)
    feature_count = IntegerField()
    can_validate = BooleanField()
    hidden = BooleanField(default=False)
    bbox = CharField(max_length=60)
    updated = DateField()
    owner = ForeignKeyField(User, related_name='projects')
    overlays = TextField(null=True)


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


class Task(BaseModel):
    user = ForeignKeyField(User, index=True, related_name='tasks')
    feature = ForeignKeyField(Feature, index=True, on_delete='CASCADE')
    skipped = BooleanField(default=False)


LAST_VERSION = 1


class Version(BaseModel):
    version = IntegerField()


@database.atomic()
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
        # Making a copy of Project.owner field, because it's not nullable
        # and we need to migrate a default value.
        admin = User.select(User.uid).where(User.uid == list(config.ADMINS)[0]).get()
        owner = ForeignKeyField(User, related_name='projects', to_field=User.uid, default=admin)

        peewee_migrate(
            migrator.add_column(User._meta.db_table, User.admin.db_column, User.admin),
            migrator.add_column(Project._meta.db_table, Project.owner.db_column, owner),
            migrator.add_column(Project._meta.db_table, Project.hidden.db_column, Project.hidden),
            migrator.add_column(Project._meta.db_table, Project.overlays.db_column,
                                Project.overlays),
            migrator.add_column(Task._meta.db_table, Task.skipped.db_column, Task.skipped)
        )
        v.version = 1
        v.save()

    if v.version != LAST_VERSION:
        raise ValueError('LAST_VERSION in db.py should be {}'.format(v.version))
