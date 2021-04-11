#!/usr/bin/env bash

JHI_DETECTED_DIR="$( cd "$( dirname $( dirname $( dirname "${BASH_SOURCE[0]}" ) ) )" >/dev/null 2>&1 && pwd )"

init_var() {
    result=""
    if [[ $1 != "" ]]; then
        result=$1
    elif [[ $2 != "" ]]; then
        result=$2
    elif [[ $3 != "" ]]; then
        result=$3
    fi
    echo $result
}

# uri of repo
JHI_REPO=$(init_var "$BUILD_REPOSITORY_URI" "$GITHUB_WORKSPACE" )

# folder where the generator-jhipster repo is cloned
if [[ "$JHI_HOME" == "" ]]; then
    JHI_HOME=$(init_var "$BUILD_REPOSITORY_LOCALPATH" "$GITHUB_WORKSPACE" "$JHI_DETECTED_DIR")
fi

# set node version
if [[ "$JHI_NODE_VERSION" == "" ]]; then
    JHI_NODE_VERSION=$(grep -o "NODE_VERSION = '[^']*'" $JHI_HOME/generators/generator-constants.js | cut -f2 -d "'")
fi

# set node version
if [[ "$JHI_NPM_VERSION" == "" ]]; then
    JHI_NPM_VERSION=$(grep -o '"npm": "[^"]*"' $JHI_HOME/generators/common/templates/package.json | cut -f4 -d '"')
fi
