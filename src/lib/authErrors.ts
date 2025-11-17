export interface AuthError {
  title: string;
  description: string;
}

type UnknownError = { message?: unknown; code?: unknown };

function normalizeErrorDetails(error: unknown): { message: string; code: string } {
  if (typeof error === 'string') {
    return { message: error, code: '' };
  }

  if (typeof error === 'object' && error !== null) {
    const { message, code } = error as UnknownError;
    return {
      message: typeof message === 'string' ? message : '',
      code: typeof code === 'string' ? code : '',
    };
  }

  return { message: '', code: '' };
}

export function getAuthErrorMessage(error: unknown): AuthError {
  const { message, code } = normalizeErrorDetails(error);
  const errorMessage = message.toLowerCase();
  const errorCode = code.toLowerCase();

  // Email validation errors
  if (errorMessage.includes('invalid email') || errorMessage.includes('email')) {
    return {
      title: 'Invalid Email',
      description: 'Please enter a valid email address (e.g., you@example.com)',
    };
  }

  // Password validation errors
  if (errorMessage.includes('password') && (errorMessage.includes('short') || errorMessage.includes('least 6'))) {
    return {
      title: 'Password Too Short',
      description: 'Your password must be at least 6 characters long',
    };
  }

  if (errorMessage.includes('password') && errorMessage.includes('match')) {
    return {
      title: "Passwords Don't Match",
      description: 'Please make sure both password fields are identical',
    };
  }

  // Duplicate email / user already exists
  if (errorMessage.includes('already registered') || 
      errorMessage.includes('already exists') || 
      errorCode.includes('23505') ||
      errorMessage.includes('duplicate')) {
    return {
      title: 'Email Already In Use',
      description: 'An account with this email already exists. Try logging in instead.',
    };
  }

  // Missing required fields
  if (errorMessage.includes('required') || errorMessage.includes('fill in')) {
    return {
      title: 'Missing Information',
      description: 'Please fill in all required fields marked with an asterisk (*)',
    };
  }

  // Wrong login credentials
  if (errorMessage.includes('invalid login credentials') || 
      errorMessage.includes('invalid credentials') ||
      errorMessage.includes('incorrect')) {
    return {
      title: 'Login Failed',
      description: 'The email or password you entered is incorrect. Please try again.',
    };
  }

  // Wrong portal / role access
  if (errorMessage.includes("doesn't have") && errorMessage.includes('access')) {
    const role = errorMessage.includes('consumer') ? 'consumer' :
                 errorMessage.includes('farmer') ? 'farmer' :
                 errorMessage.includes('driver') ? 'driver' : 'required';
    return {
      title: 'Wrong Portal',
      description: `Your account doesn't have ${role} access. Try logging in through the correct portal.`,
    };
  }

  // Invalid phone number
  if (errorMessage.includes('phone') || errorMessage.includes('tel')) {
    return {
      title: 'Invalid Phone Number',
      description: 'Please enter a valid phone number (e.g., +1 555-000-0000)',
    };
  }

  // Invalid ZIP code
  if (errorMessage.includes('zip') || errorMessage.includes('postal')) {
    return {
      title: 'Invalid ZIP Code',
      description: 'Please enter a valid 5-digit ZIP code',
    };
  }

  // Database constraint/syntax errors
  if (errorMessage.includes('uuid') || errorMessage.includes('syntax') || errorMessage.includes('invalid input syntax')) {
    return {
      title: 'Invalid Selection',
      description: 'Please select a valid option from the dropdown menu',
    };
  }

  // Profile update failures
  if (errorMessage.includes('profile setup failed') || errorMessage.includes('profile') && errorMessage.includes('failed')) {
    return {
      title: 'Registration Incomplete',
      description: 'Your account was created but profile setup failed. Please contact support to complete registration.',
    };
  }

  // Account creation failures
  if (errorMessage.includes('account creation failed')) {
    return {
      title: 'Registration Failed',
      description: message.replace('Account creation failed: ', '') || 'Unable to create your account. Please try again.',
    };
  }

  // Pending approval
  if (errorMessage.includes('pending approval')) {
    return {
      title: 'Application Already Submitted',
      description: 'An application with this email is already pending approval. Please wait for admin review.',
    };
  }

  // Generic fallback
  return {
    title: 'Something Went Wrong',
    description: message || 'Please try again or contact support if the problem persists',
  };
}
