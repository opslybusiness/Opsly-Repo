from database import Base, engine
from models import User  # make sure models.py is in the same folder

def create_tables():
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

if __name__ == "__main__":
    create_tables()
