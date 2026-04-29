from django.core.validators import RegexValidator


class DomainValidator(RegexValidator):
    def __init__(self):
        
        regex = r'^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$'
        
        super().__init__(
            regex=regex,
            message="Enter a valid domain (e.g., 'example.com' or 'sub.example.com')."
        )
