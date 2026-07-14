// Jenkins security bootstrap — runs from init.groovy.d on every boot.
// Creates the admin account from container env on first boot only; a
// configured realm is left untouched so manual changes survive restarts.
// NOTE: no brace-form expansions — blueprint templating reserves the syntax.
import jenkins.model.Jenkins
import hudson.security.HudsonPrivateSecurityRealm
import hudson.security.FullControlOnceLoggedInAuthorizationStrategy

def instance = Jenkins.get()
def user = System.getenv("JENKINS_ADMIN_USER")
def pass = System.getenv("JENKINS_ADMIN_PASSWORD")

if (user == null || pass == null) {
  println "devstation: JENKINS_ADMIN_USER/PASSWORD not set; skipping security bootstrap"
  return
}

if (!(instance.getSecurityRealm() instanceof HudsonPrivateSecurityRealm)) {
  def realm = new HudsonPrivateSecurityRealm(false)
  realm.createAccount(user, pass)
  instance.setSecurityRealm(realm)

  def strategy = new FullControlOnceLoggedInAuthorizationStrategy()
  strategy.setAllowAnonymousRead(false)
  instance.setAuthorizationStrategy(strategy)

  instance.save()
  println "devstation: security realm configured with the admin account"
}
