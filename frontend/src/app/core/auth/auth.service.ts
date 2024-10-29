import {computed, inject, Injectable, signal, WritableSignal} from '@angular/core';
import {HttpClient, HttpParams, HttpStatusCode} from "@angular/common/http";
import {Location} from "@angular/common";
import {Observable} from "rxjs";
import {State} from "../model/state.model";
import {User} from "../model/user.model";
import {environment} from "../../../environments/environment";

// Injectable decorator makes Auth service available
// for dependency injection in application
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // Injecting HttpClient for making HTTP requests
  http = inject(HttpClient);

  // Injecting Location for handling URL redirection
  location = inject(Location);

  // Placeholder for when the user is not connected
  notConnected = "NOT_CONNECTED";

  // Writable signal to store the current user state
  private fetchUser$: WritableSignal<State<User>> =
    signal(State.Builder<User>().forSuccess({email: this.notConnected}));
    
  // Computed property to access the user state signal
  fetchUser = computed(() => this.fetchUser$());

  // Fetches the authenticated user, with an option
  // to force synchronization
  fetch(forceResync: boolean): void {
    this.fetchHttpUser(forceResync)
      .subscribe({
        // Updates the user state to success if
        // fetch is successful
        next: user => this.fetchUser$.set(State.Builder<User>().forSuccess(user)),
        
        // Error handling: if unauthorized and authenticated,
        // set user as not connected
        error: err => {
          if (err.status === HttpStatusCode.Unauthorized && this.isAuthenticated()) {
            this.fetchUser$.set(State.Builder<User>().forSuccess({email: this.notConnected}));
          } else {
            this.fetchUser$.set(State.Builder<User>().forError(err));
          }
        }
      })
  }

  // Initiates login by redirecting to OAuth2 authorization URL
  login(): void {
    location.href = `${location.origin}${this.location.prepareExternalUrl("oauth2/authorization/okta")}`;
  }

  // Logs the user out by calling logout endpoint and
  // redirecting to the logout URL
  logout(): void {
    this.http.post(`${environment.API_URL}/auth/logout`, {})
      .subscribe({
        // On successful logout, reset user state and redirect
        // to logout URL
        next: (response: any) => {
          this.fetchUser$.set(State.Builder<User>()
            .forSuccess({email: this.notConnected}));
          location.href = response.logoutUrl;
        }
      })
  }

  // Checks if user is authenticated by verifying if
  // user is not marked as not connected
  isAuthenticated(): boolean {
    if (this.fetchUser$().value) {
      return this.fetchUser$().value!.email !== this.notConnected;
    } else {
      return false;
    }
  }

  // Makes an HTTP GET request to fetch authenticated user's details
  fetchHttpUser(forceResync: boolean): Observable<User> {
    const params = new HttpParams().set('forceResync', forceResync);
    return this.http.get<User>(`${environment.API_URL}/auth/get-authenticated-user`, {params});
  }

  // Checks if user has any of specified authorities (roles)
  hasAnyAuthority(authorities: string[] | string): boolean {
    // Returns false if user is not connected
    if(this.fetchUser$().value!.email === this.notConnected) {
      return false;
    }
    // Ensures authorities is an array for easier comparison
    if(!Array.isArray(authorities)) {
      authorities = [authorities];
    }
    // Checks if any of user's authorities match specified authorities
    return this.fetchUser$().value!.authorities!
      .some((authority: string) => authorities.includes(authority));
  }
}
