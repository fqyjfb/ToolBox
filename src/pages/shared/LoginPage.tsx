import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthStore'
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react'
import { authService } from '../../services/AuthService'
import './LoginPage.css'

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { login, register, isLoading, error, isAuthenticated } = useAuth()
  
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'reset'>('login')
  const [showPassword, setShowPassword] = useState(false)
  
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
    rememberMe: false
  })
  
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    phone: '',
    agreeTerms: false
  })
  
  const [resetForm, setResetForm] = useState({
    email: ''
  })
  
  const [touched, setTouched] = useState({
    login: { email: false, password: false, rememberMe: false },
    register: { username: false, email: false, password: false, phone: false, agreeTerms: false },
    reset: { email: false }
  })
  
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
    
    const savedUsername = localStorage.getItem('toolbox_username')
    const savedPassword = localStorage.getItem('toolbox_password')
    const lastLoginTime = localStorage.getItem('toolbox_last_login_time')
    
    const TWO_DAYS_IN_MS = 2 * 24 * 60 * 60 * 1000
    const now = Date.now()
    
    if (savedUsername) {
      setLoginForm(prev => ({ ...prev, email: savedUsername }))
      
      if (savedPassword && lastLoginTime) {
        const lastLogin = parseInt(lastLoginTime, 10)
        if (now - lastLogin <= TWO_DAYS_IN_MS) {
          setLoginForm(prev => ({ ...prev, password: savedPassword, rememberMe: true }))
        } else {
          localStorage.removeItem('toolbox_password')
          localStorage.removeItem('toolbox_last_login_time')
        }
      }
    }
  }, [isAuthenticated, navigate])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    
    if (activeTab === 'login') {
      if (type === 'checkbox') {
        setLoginForm(prev => ({ ...prev, [name]: checked }))
      } else {
        setLoginForm(prev => ({ ...prev, [name]: value }))
      }
    } else if (activeTab === 'register') {
      if (type === 'checkbox') {
        setRegisterForm(prev => ({ ...prev, [name]: checked }))
      } else {
        setRegisterForm(prev => ({ ...prev, [name]: value }))
      }
    } else if (activeTab === 'reset') {
      setResetForm(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target
    
    if (activeTab === 'login') {
      setTouched(prev => ({
        ...prev,
        login: { ...prev.login, [name]: true }
      }))
    } else if (activeTab === 'register') {
      setTouched(prev => ({
        ...prev,
        register: { ...prev.register, [name]: true }
      }))
    } else if (activeTab === 'reset') {
      setTouched(prev => ({
        ...prev,
        reset: { ...prev.reset, [name]: true }
      }))
    }
  }

  const isLoginEmailValid = touched.login.email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginForm.email) : true
  const isLoginPasswordValid = touched.login.password ? loginForm.password.length >= 6 : true
  const isLoginFormValid = isLoginEmailValid && isLoginPasswordValid

  const isRegisterUsernameValid = touched.register.username ? registerForm.username.length >= 3 : true
  const isRegisterEmailValid = touched.register.email ? /^[^@]+@[^@]+\.[^@]+$/.test(registerForm.email) : true
  const isRegisterPasswordValid = touched.register.password ? registerForm.password.length >= 6 : true
  const isRegisterPhoneValid = touched.register.phone ? /^1[3-9]\d{9}$/.test(registerForm.phone) : true
  const isRegisterFormValid = isRegisterUsernameValid && isRegisterEmailValid && isRegisterPasswordValid && isRegisterPhoneValid && registerForm.agreeTerms

  const isResetEmailValid = touched.reset.email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetForm.email) : true

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(prev => ({
      ...prev,
      login: { email: true, password: true, rememberMe: true }
    }))
    
    if (isLoginFormValid) {
      await login({ username: loginForm.email, password: loginForm.password })
      
      localStorage.setItem('toolbox_username', loginForm.email)
      if (loginForm.rememberMe) {
        localStorage.setItem('toolbox_password', loginForm.password)
        localStorage.setItem('toolbox_last_login_time', Date.now().toString())
      } else {
        localStorage.removeItem('toolbox_password')
        localStorage.removeItem('toolbox_last_login_time')
      }
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(prev => ({
      ...prev,
      register: { username: true, email: true, password: true, phone: true, agreeTerms: true }
    }))
    
    if (isRegisterFormValid) {
      await register({
        username: registerForm.username,
        email: registerForm.email,
        password: registerForm.password,
        phone: registerForm.phone
      })
    }
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(prev => ({
      ...prev,
      reset: { email: true }
    }))
    
    if (isResetEmailValid) {
      try {
        const { error } = await authService.resetPassword(resetForm.email)
        if (error) {
          console.error('重置密码失败:', error)
        } else {
          setResetSent(true)
        }
      } catch (error) {
        console.error('重置密码失败:', error)
      }
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="./favicon.png" alt="ToolBox Logo" />
          <h1 className="shine">ToolBox</h1>
        </div>

        <div className="login-subtitle">
          <p>
            {activeTab === 'login' ? '欢迎回来，请登录您的账号' : 
             activeTab === 'register' ? '创建新账号' : 
             '请输入您的邮箱，我们将发送重置密码的链接'}
          </p>
        </div>

        {error && (
          <div className="login-error-message">
            {error}
          </div>
        )}

        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="login-form">
            <div className="login-input-group">
              <Mail className="login-icon" />
              <input
                placeholder="邮箱"
                id="login-email"
                name="email"
                type="email"
                className={`login-input ${!isLoginEmailValid && touched.login.email ? 'error' : ''}`}
                value={loginForm.email}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                required
              />
            </div>
            {touched.login.email && !isLoginEmailValid && (
              <p className="login-error-text">请输入有效的邮箱地址</p>
            )}

            <div className="login-input-group">
              <Lock className="login-icon" />
              <input
                placeholder="密码"
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className={`login-input ${!isLoginPasswordValid && touched.login.password ? 'error' : ''}`}
                value={loginForm.password}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                required
              />
              <span 
                className="login-eye-icon"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </span>
            </div>
            {touched.login.password && !isLoginPasswordValid && (
              <p className="login-error-text">密码长度至少为6位</p>
            )}

            <div className="login-remember-forgot">
              <label className="login-remember-label">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={loginForm.rememberMe}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                />
                记住密码
              </label>
              <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('reset'); }} className="login-forgot-link">忘记密码？</a>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isLoginFormValid}
              className="login-button"
            >
              {isLoading ? (
                <div className="login-loader">
                  <div className="login-dot login-dot-1" />
                  <div className="login-dot login-dot-2" />
                  <div className="login-dot login-dot-3" />
                </div>
              ) : (
                "登录"
              )}
            </button>

            <div className="login-tab-switch">
              还没有账号？ <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('register'); }}>立即注册</a>
            </div>
          </form>
        )}

        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="login-form">
            <div className="login-input-group">
              <User className="login-icon" />
              <input
                placeholder="用户名"
                id="register-username"
                name="username"
                type="text"
                className={`login-input ${!isRegisterUsernameValid && touched.register.username ? 'error' : ''}`}
                value={registerForm.username}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                required
              />
            </div>
            {touched.register.username && !isRegisterUsernameValid && (
              <p className="login-error-text">用户名长度至少为3位</p>
            )}

            <div className="login-input-group">
              <Mail className="login-icon" />
              <input
                placeholder="邮箱"
                id="register-email"
                name="email"
                type="email"
                className={`login-input ${!isRegisterEmailValid && touched.register.email ? 'error' : ''}`}
                value={registerForm.email}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                required
              />
            </div>
            {touched.register.email && !isRegisterEmailValid && (
              <p className="login-error-text">请输入有效的邮箱地址</p>
            )}

            <div className="login-input-group">
              <Lock className="login-icon" />
              <input
                placeholder="密码"
                id="register-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                className={`login-input ${!isRegisterPasswordValid && touched.register.password ? 'error' : ''}`}
                value={registerForm.password}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                required
              />
              <span 
                className="login-eye-icon"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </span>
            </div>
            {touched.register.password && !isRegisterPasswordValid && (
              <p className="login-error-text">密码长度至少为6位</p>
            )}

            <div className="login-input-group">
              <Phone className="login-icon" />
              <input
                placeholder="手机号"
                id="register-phone"
                name="phone"
                type="tel"
                className={`login-input ${!isRegisterPhoneValid && touched.register.phone ? 'error' : ''}`}
                value={registerForm.phone}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                required
              />
            </div>
            {touched.register.phone && !isRegisterPhoneValid && (
              <p className="login-error-text">请输入有效的手机号码</p>
            )}

            <div className="login-terms-container">
              <input
                type="checkbox"
                id="agreeTerms"
                name="agreeTerms"
                checked={registerForm.agreeTerms}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
              />
              <label htmlFor="agreeTerms" className="login-terms-label">
                我同意 <a href="#">服务条款</a> 和 <a href="#">隐私政策</a>
              </label>
            </div>
            {touched.register.agreeTerms && !registerForm.agreeTerms && (
              <p className="login-error-text">请同意服务条款和隐私政策</p>
            )}

            <button
              type="submit"
              disabled={isLoading || !isRegisterFormValid}
              className="login-button"
            >
              {isLoading ? (
                <div className="login-loader">
                  <div className="login-dot login-dot-1" />
                  <div className="login-dot login-dot-2" />
                  <div className="login-dot login-dot-3" />
                </div>
              ) : (
                "注册"
              )}
            </button>

            <div className="login-tab-switch">
              已有账号？ <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('login'); }}>立即登录</a>
            </div>
          </form>
        )}

        {activeTab === 'reset' && (
          <form onSubmit={handleResetSubmit} className="login-form">
            {resetSent ? (
              <div className="login-success-message">
                重置密码的链接已发送到您的邮箱，请查收
              </div>
            ) : (
              <>
                <div className="login-input-group">
                  <Mail className="login-icon" />
                  <input
                    placeholder="邮箱"
                    id="reset-email"
                    name="email"
                    type="email"
                    className={`login-input ${!isResetEmailValid && touched.reset.email ? 'error' : ''}`}
                    value={resetForm.email}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    required
                  />
                </div>
                {touched.reset.email && !isResetEmailValid && (
                  <p className="login-error-text">请输入有效的邮箱地址</p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="login-button"
                >
                  {isLoading ? (
                    <div className="login-loader">
                      <div className="login-dot login-dot-1" />
                      <div className="login-dot login-dot-2" />
                      <div className="login-dot login-dot-3" />
                    </div>
                  ) : (
                    "发送重置链接"
                  )}
                </button>
              </>
            )}

            <div className="login-tab-switch">
              想起密码了？ <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('login'); }}>立即登录</a>
            </div>
          </form>
        )}

        {activeTab === 'login' && (
          <>
            <div className="login-social-container">
              <span className="login-social-title">或使用以下方式登录</span>
              <div className="login-social-accounts">
                <button className="login-social-button">
                  <svg viewBox="0 0 488 512" height="1em" xmlns="http://www.w3.org/2000/svg">
                    <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
                  </svg>
                </button>
                <button className="login-social-button">
                  <svg viewBox="0 0 384 512" height="1em" xmlns="http://www.w3.org/2000/svg">
                    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                  </svg>
                </button>
                <button className="login-social-button">
                  <svg viewBox="0 0 512 512" height="1em" xmlns="http://www.w3.org/2000/svg">
                    <path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z" />
                  </svg>
                </button>
              </div>
            </div>
            <span className="login-agreement"><a href="#">了解用户许可协议</a></span>
          </>
        )}
      </div>
    </div>
  )
}

export default LoginPage