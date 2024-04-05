package com.mycompany.myapp.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springdoc.core.customizers.ServerBaseUrlCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.context.annotation.RequestScope;
import org.springframework.web.util.UriComponentsBuilder;

@Configuration
public class OpenApiCustomizer {

    @RequestScope
    @Bean
    public ServerBaseUrlCustomizer microserviceBaseUrlCustomizer(HttpServletRequest request) {
        return serverBaseUrl ->
            UriComponentsBuilder.newInstance()
                .scheme(request.getHeader("X-Forwarded-Proto"))
                .host(request.getHeader("X-Forwarded-Host"))
                .path(request.getHeader("X-Forwarded-Prefix"))
                .build()
                .toUriString();
    }
}
