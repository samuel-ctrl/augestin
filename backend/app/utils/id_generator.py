import random
import string


def generate_student_id() -> str:
    chars = string.ascii_uppercase + string.digits
    code = "".join(random.choices(chars, k=6))
    return f"STU-{code}"


def generate_password() -> str:
    chars = string.ascii_letters + string.digits
    code = "".join(random.choices(chars, k=4))
    return f"Stu@{code}"
