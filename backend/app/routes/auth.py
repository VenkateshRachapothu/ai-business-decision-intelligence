from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import timedelta
from typing import Any
from jose import JWTError, jwt

from ..core.database import get_db
from ..core.security import verify_password, get_password_hash, create_access_token
from ..core.config import settings
from ..models.user import User
from ..schemas.user import UserCreate, UserResponse, Token, TokenData

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(
        or_(
            User.username == token_data.username,
            func.lower(User.username) == token_data.username.lower()
        )
    ).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    clean_username = user_in.username.strip() if user_in.username else ""
    clean_email = user_in.email.strip() if user_in.email else ""
    user_exists = db.query(User).filter(
        or_(
            User.username == clean_username,
            User.email == clean_email,
            func.lower(User.username) == clean_username.lower(),
            func.lower(User.email) == clean_email.lower()
        )
    ).first()
    if user_exists:
        raise HTTPException(
            status_code=400,
            detail="The user with this username or email already exists in the system."
        )
    user = User(
        username=clean_username,
        email=clean_email,
        hashed_password=get_password_hash(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.post("/login", response_model=Token)
def login(db: Session = Depends(get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    identifier = form_data.username.strip() if form_data.username else ""
    user = db.query(User).filter(
        or_(
            User.username == identifier,
            User.email == identifier,
            func.lower(User.username) == identifier.lower(),
            func.lower(User.email) == identifier.lower()
        )
    ).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
