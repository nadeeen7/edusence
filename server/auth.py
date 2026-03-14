import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, current_app
from models import Teacher, Student

def generate_token(user_id, role):
    """Generate JWT token for a user"""
    try:
        payload = {
            'exp': datetime.utcnow() + timedelta(days=7),
            'iat': datetime.utcnow(),
            'sub': str(user_id),
            'role': role
        }
        return jwt.encode(
            payload,
            current_app.config['JWT_SECRET_KEY'],
            algorithm='HS256'
        )
    except Exception as e:
        return str(e)

def token_required(f):
    """Decorator to protect routes with JWT"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        
        try:
            # Debug: what secret are we using?
            # print(f"DEBUG: Using Secret: {current_app.config.get('JWT_SECRET_KEY')}")
            
            data = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=["HS256"])
            user_id = data['sub']
            role = data['role']
            
            if role == 'teacher':
                try:
                    current_user = Teacher.query.get(int(user_id))
                except (ValueError, TypeError):
                    return jsonify({'message': 'Invalid teacher ID format'}), 401
            else:
                current_user = Student.query.get(user_id)
                
            if not current_user:
                return jsonify({'message': 'User not found in database'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token has expired'}), 401
        except jwt.InvalidTokenError as e:
            return jsonify({'message': f'Invalid token: {str(e)}'}), 401
        except Exception as e:
            return jsonify({'message': f'Auth Error: {str(e)}'}), 401
            
        return f(current_user, *args, **kwargs)
    
    return decorated
