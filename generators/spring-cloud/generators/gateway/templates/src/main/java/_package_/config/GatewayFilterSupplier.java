package com.mycompany.myapp.config;

import static org.springframework.web.servlet.function.HandlerFilterFunction.ofRequestProcessor;

import java.net.URI;
import org.springframework.cloud.gateway.server.mvc.common.Shortcut;
import org.springframework.cloud.gateway.server.mvc.filter.SimpleFilterSupplier;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.function.HandlerFilterFunction;
import org.springframework.web.servlet.function.ServerRequest;
import org.springframework.web.servlet.function.ServerResponse;
import org.springframework.web.util.UriComponentsBuilder;

public interface GatewayFilterSupplier {

    public static HandlerFilterFunction<ServerResponse, ServerResponse> stripGatewayPrefix() {
        return stripGatewayPrefix(2);
    }

    @Shortcut
    public static HandlerFilterFunction<ServerResponse, ServerResponse> stripGatewayPrefix(int parts) {
        return stripGatewayPrefix(parts, "X-Forwarded-Prefix");
    }

    @Shortcut
    public static HandlerFilterFunction<ServerResponse, ServerResponse> stripGatewayPrefix(int parts, String header) {
        return ofRequestProcessor(request -> {
            String path = request.uri().getRawPath();
            String[] originalParts = StringUtils.tokenizeToStringArray(path, "/");

            // all new paths start with /
            StringBuilder newPath = new StringBuilder("/");
            StringBuilder prefix = new StringBuilder("");
            for (int i = 0; i < originalParts.length; i++) {
                if (i >= parts) {
                    // only append slash if this is the second part or greater
                    if (newPath.length() > 1) {
                        newPath.append('/');
                    }
                    newPath.append(originalParts[i]);
                } else {
                    prefix.append("/").append(originalParts[i]);
                }
            }
            if (newPath.length() > 1 && path.endsWith("/")) {
                newPath.append('/');
            }

            URI prefixedUri = UriComponentsBuilder.fromUri(request.uri()).replacePath(newPath.toString()).build().toUri();
            return ServerRequest.from(request).uri(prefixedUri).header(header, prefix.toString()).build();
        });
    }

    class FilterSupplier extends SimpleFilterSupplier {

        public FilterSupplier() {
            super(GatewayFilterSupplier.class);
        }
    }
}
