# Generated by Django 5.1.11 on 2025-07-24 20:11

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "authentik_policies_reputation",
            "0008_reputation_authentik_p_expires_da493f_idx_and_more",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="reputation",
            name="updated",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
