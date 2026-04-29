"""Dashboard metrics; analytics storage was removed — return stable empty JSON."""

import json


def get_awards_report(user):
    del user
    result = {
        "today_count": 0,
        "today_difference_percentage": 0.0,
        "month_count": 0,
        "month_difference_percentage": 0.0,
        "year_count": 0,
        "year_difference_percentage": 0.0,
    }
    return json.dumps(result)


def get_conversion_rates(user):
    del user
    result = {
        "today_rate": 0,
        "today_difference_rate": 0,
        "month_rate": 0,
        "month_difference_rate": 0,
        "year_rate": 0,
        "year_difference_rate": 0,
    }
    return json.dumps(result)

