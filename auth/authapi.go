package auth

import (
  "fmt"
  "log"
  "net/http"
  "strconv"
  "time"
)

const (
  tokenCookieName = "MIMSRV_TOKEN"
)

func (h *Handler) initApiHandler() {
  mux := http.NewServeMux()
  mux.HandleFunc(h.apiPrefix("login"), h.login)
  mux.HandleFunc(h.apiPrefix("logout"), h.logout)
  h.ApiHandler = mux
}

func (h *Handler) RequireAuth(httpHandler http.Handler) http.Handler {
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request){
    token := cookieValue(r, tokenCookieName)
    idstr := clientIdString(r)
    if isValidToken(token, idstr) {
      httpHandler.ServeHTTP(w, r)
    } else {
      // No token, or token is not valid
      http.Error(w, "Invalid token", http.StatusUnauthorized)
    }
  })
}

func (h *Handler) apiPrefix(s string) string {
  return fmt.Sprintf("%s%s/", h.config.Prefix, s)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
  userid := r.FormValue("userid")
  nonce := r.FormValue("nonce")
  timestr := r.FormValue("time")
  seconds, err := strconv.ParseInt(timestr, 10, 64)
  if err != nil {
    log.Printf("Error converting time string '%s': %v\n", timestr, err)
    seconds = 0
  }

  if h.nonceIsValidNow(userid, nonce, seconds) {
    // OK to log in; generate a bearer token and put in a cookie
    idstr := clientIdString(r)
    token := newToken(userid, idstr)
    tokenCookie := &http.Cookie{
      Name: tokenCookieName,
      Path: "/",
      Value: token.Key,
      Expires: token.expiry,
      HttpOnly: true,
    }
    http.SetCookie(w, tokenCookie)
  } else {
    http.Error(w, "Invalid userid or nonce", http.StatusUnauthorized)
    return
  }

  w.WriteHeader(http.StatusOK)
  w.Write([]byte(`{"status": "ok"}`))
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
  // Clear our token cookie
  tokenCookie := &http.Cookie{
    Name: tokenCookieName,
    Path: "/",
    Value: "",
    Expires: time.Now().AddDate(-1, 0, 0),
  }
  http.SetCookie(w, tokenCookie)
  w.WriteHeader(http.StatusOK)
  w.Write([]byte(`{"status": "ok"}`))
}

func clientIdString(r *http.Request) string {
  return r.UserAgent()
}

func cookieValue(r *http.Request, cookieName string) string {
  cookie, err := r.Cookie(cookieName)
  if err != nil {
    return ""
  }
  return cookie.Value
}