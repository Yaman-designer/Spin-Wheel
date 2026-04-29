from django import forms
from datetime import datetime

class BaseForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super(BaseForm, self).__init__(*args, **kwargs)

        for visible in self.visible_fields():
            visible.field.widget.attrs["autocomplete"] = "off"
            if type(visible.field.widget) not in [forms.widgets.CheckboxInput]:
                visible.field.widget.attrs['class'] = 'form-control'
            if type(visible.field.widget) == forms.widgets.CheckboxInput:
                visible.field.widget.attrs['class'] = "form-check-input"
            # if type(visible.field)==forms.fields.DateTimeField:
            #     visible.field.widget.attrs['class'] += ' sat-datetime'
            # if type(visible.field)==forms.fields.DateField:
            #     visible.field.widget.attrs['class'] += ' sat-date'
